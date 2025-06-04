import WebSocket from 'ws';
import { Server } from 'http';
import { Position } from '../types';

interface GameRoom {
    players: {
        white?: WebSocket;
        black?: WebSocket;
    };
    spectators: WebSocket[];
    lastActivity: number;
}

export class GameServer {
    private rooms: Map<string, GameRoom> = new Map();
    private wss: WebSocket.Server;
    private cleanupInterval: NodeJS.Timeout;

    constructor(server: Server) {
        this.wss = new WebSocket.Server({ server });
        this.setupWebSocketServer();
        
        // Clean up inactive rooms every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanupInactiveRooms(), 5 * 60 * 1000);
    }

    private cleanupInactiveRooms() {
        const now = Date.now();
        let removedCount = 0;
        
        for (const [roomId, room] of this.rooms.entries()) {
            // Remove rooms that have been inactive for more than 30 minutes
            if (now - room.lastActivity > 30 * 60 * 1000) {
                this.rooms.delete(roomId);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            console.log(`Cleaned up ${removedCount} inactive rooms. Active rooms: ${this.rooms.size}`);
        }
    }

    private setupWebSocketServer() {
        console.log('Setting up WebSocket server');
        
        this.wss.on('connection', (ws: WebSocket, req: any) => {
            console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);
            console.log(`URL: ${req.url}`);
            
            const roomId = this.getRoomIdFromUrl(req.url);
            if (!roomId) {
                console.log('Connection rejected: No room ID provided');
                ws.close(1000, 'No room ID provided');
                return;
            }

            // Normalize room ID to uppercase
            const normalizedRoomId = roomId.toUpperCase();
            console.log(`New connection to room: ${normalizedRoomId}`);
            this.handleConnection(ws, normalizedRoomId);
        });
        
        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });
        
        this.wss.on('listening', () => {
            console.log('WebSocket server is listening');
        });
        
        console.log(`WebSocket server initialized with ${this.wss.clients.size} clients`);
    }

    private getRoomIdFromUrl(url: string): string | null {
        console.log(`Parsing room ID from URL: ${url}`);
        
        // Simple case: Direct room ID in path (e.g., /ws/game/ABC123)
        let match = url.match(/\/ws\/game\/([A-Z0-9]{6})/i);
        if (match) {
            console.log(`Extracted room ID from path: ${match[1].toUpperCase()}`);
            return match[1].toUpperCase();
        }
        
        // Case for joining with roomId parameter (e.g., ?roomId=ABC123)
        match = url.match(/[?&](?:roomId|ROOMID)=([A-Z0-9]{6})/i);
        if (match) {
            console.log(`Extracted room ID from roomId parameter: ${match[1].toUpperCase()}`);
            return match[1].toUpperCase();
        }
        
        // Fallback: Extract any 6-character alphanumeric sequence
        match = url.match(/([A-Z0-9]{6})/i);
        if (match) {
            console.log(`Extracted room ID as fallback: ${match[1].toUpperCase()}`);
            return match[1].toUpperCase();
        }
        
        console.error(`Failed to extract room ID from URL: ${url}`);
        return null;
    }

    private handleConnection(ws: WebSocket, roomId: string) {
        let room = this.rooms.get(roomId);
        
        if (!room) {
            console.log(`Creating new room: ${roomId}`);
            room = { 
                players: {}, 
                spectators: [],
                lastActivity: Date.now()
            };
            this.rooms.set(roomId, room);
            
            // CRITICAL: First player in a new room is ALWAYS White (host)
            console.log(`CREATOR: First player in room ${roomId}, assigning WHITE`);
            room.players.white = ws;
            this.sendToClient(ws, {
                type: 'color_assigned',
                color: 'white'
            });
            
            // Send confirmation
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    this.sendToClient(ws, {
                        type: 'color_confirmed',
                        color: 'white',
                        message: 'You are playing as White (Room Creator)'
                    });
                }
            }, 500);
            
            // Send current room state to the new player
            this.sendRoomState(ws, room);
            
            // Handle messages from the client
            this.setupMessageHandlers(ws, roomId);
            
            return;
        }
        
        console.log(`Joining existing room: ${roomId}`);
        console.log(`Room status - White player: ${room.players.white ? 'Connected' : 'Empty'}, Black player: ${room.players.black ? 'Connected' : 'Empty'}`);
        
        // Update last activity timestamp
        room.lastActivity = Date.now();
        
        // Check for duplicate connections
        if ((room.players.white === ws) || (room.players.black === ws)) {
            console.log(`Duplicate connection detected for room ${roomId}`);
            ws.close(1000, 'Duplicate connection');
            return;
        }

        // Check socket states
        const whiteConnected = room.players.white && room.players.white.readyState === WebSocket.OPEN;
        const blackConnected = room.players.black && room.players.black.readyState === WebSocket.OPEN;
        
        console.log(`White player state: ${room.players.white ? this.getReadyStateString(room.players.white.readyState) : 'Not assigned'}`);
        console.log(`Black player state: ${room.players.black ? this.getReadyStateString(room.players.black.readyState) : 'Not assigned'}`);

        // Handle joining logic - prioritize assigning Black to the second player
        if (whiteConnected && !blackConnected) {
            // White exists but black doesn't - assign as black
            console.log(`JOINER: White player exists in room ${roomId}, assigning BLACK to joining player`);
            room.players.black = ws;
            this.sendToClient(ws, {
                type: 'color_assigned',
                color: 'black'
            });
            
            // Send confirmation that the color was assigned
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    this.sendToClient(ws, {
                        type: 'color_confirmed',
                        color: 'black',
                        message: 'You are playing as Black'
                    });
                }
            }, 500);
            
            // When second player joins, notify both players that game is starting
            console.log(`Both players joined room ${roomId}, starting game`);
            
            // Check if both players are actually connected before sending game_start
            if (room.players.white && room.players.white.readyState === WebSocket.OPEN) {
                this.broadcastToRoom(roomId, {
                    type: 'game_start'
                });
                
                // Send another game_start message after a short delay to ensure it's received
                setTimeout(() => {
                    this.broadcastToRoom(roomId, {
                        type: 'game_start',
                        message: 'Game is starting now'
                    });
                }, 1000);
            }
        } else if (!whiteConnected && blackConnected) {
            // Black exists but white doesn't - assign as white
            console.log(`JOINER: Black player exists in room ${roomId}, assigning WHITE to joining player`);
            room.players.white = ws;
            this.sendToClient(ws, {
                type: 'color_assigned',
                color: 'white'
            });
            
            // Send confirmation that the color was assigned
            setTimeout(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    this.sendToClient(ws, {
                        type: 'color_confirmed',
                        color: 'white',
                        message: 'You are playing as White'
                    });
                }
            }, 500);
            
            // When second player joins, notify both players that game is starting
            console.log(`Both players joined room ${roomId}, starting game`);
            
            // Check if both players are actually connected before sending game_start
            if (room.players.black && room.players.black.readyState === WebSocket.OPEN) {
                this.broadcastToRoom(roomId, {
                    type: 'game_start'
                });
                
                // Send another game_start message after a short delay to ensure it's received
                setTimeout(() => {
                    this.broadcastToRoom(roomId, {
                        type: 'game_start',
                        message: 'Game is starting now'
                    });
                }, 1000);
            }
        } else if (whiteConnected && blackConnected) {
            // Room is full, add as spectator
            console.log(`Room ${roomId} is full, adding as spectator`);
            room.spectators.push(ws);
            this.sendToClient(ws, {
                type: 'spectator_joined'
            });
        } else {
            // This should rarely happen, but handle it for completeness
            // If white slot is available, assign as white (preferred)
            if (!room.players.white) {
                console.log(`Assigning as WHITE to player in room ${roomId}`);
                room.players.white = ws;
                this.sendToClient(ws, {
                    type: 'color_assigned',
                    color: 'white'
                });
            } else if (!room.players.black) {
                console.log(`Assigning as BLACK to player in room ${roomId}`);
                room.players.black = ws;
                this.sendToClient(ws, {
                    type: 'color_assigned',
                    color: 'black'
                });
            } else {
                // Room is full but we somehow got here
                room.spectators.push(ws);
                this.sendToClient(ws, {
                    type: 'spectator_joined'
                });
            }
        }

        // Send current room state to the new player
        this.sendRoomState(ws, room);
        
        // Handle messages from the client
        this.setupMessageHandlers(ws, roomId);
    }

    private setupMessageHandlers(ws: WebSocket, roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        ws.on('message', (message: string) => {
            try {
                const data = JSON.parse(message.toString());
                console.log(`Received message in room ${roomId}:`, data);
                room.lastActivity = Date.now();
                this.handleMessage(ws, roomId, data);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });

        ws.on('close', () => {
            console.log(`Player disconnected from room ${roomId}`);
            this.handleDisconnection(ws, roomId);
        });
    }

    private sendRoomState(ws: WebSocket, room: GameRoom) {
        console.log('Sending room state to player');
        
        // Let the client know if their opponent is already in the room
        const whiteConnected = room.players.white && room.players.white.readyState === WebSocket.OPEN;
        const blackConnected = room.players.black && room.players.black.readyState === WebSocket.OPEN;
        
        if (room.players.white === ws && blackConnected) {
            console.log('White player connected, black already present - sending game_start');
            this.sendToClient(ws, { type: 'game_start' });
        } else if (room.players.black === ws && whiteConnected) {
            console.log('Black player connected, white already present - sending game_start');
            this.sendToClient(ws, { type: 'game_start' });
        } else if (room.players.white === ws) {
            console.log('White player connected, waiting for black');
        } else if (room.players.black === ws) {
            console.log('Black player connected, waiting for white');
        }
    }

    private handleMessage(ws: WebSocket, roomId: string, data: any) {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.log(`Received message for non-existent room: ${roomId}`);
            return;
        }

        switch (data.type) {
            case 'ping':
                console.log(`Received ping from client in room ${roomId}`);
                this.sendToClient(ws, { type: 'pong' });
                break;
                
            case 'disconnect':
                console.log(`Received disconnect message from client in room ${roomId}`);
                // Don't immediately remove the player, just acknowledge the disconnect
                this.sendToClient(ws, { type: 'disconnect_ack' });
                break;
                
            case 'move':
                // Verify the move is coming from the correct player
                const isWhitePlayer = room.players.white === ws;
                const isBlackPlayer = room.players.black === ws;
                const otherPlayer = isWhitePlayer ? room.players.black : room.players.white;

                console.log(`Move from ${isWhitePlayer ? 'WHITE' : isBlackPlayer ? 'BLACK' : 'SPECTATOR'} player in room ${roomId}`);
                
                if (!data.from || !data.to) {
                    console.error('Invalid move data - missing from or to position');
                    return;
                }
                
                // Ensure positions are proper objects
                const fromPos = {
                    row: data.from.row,
                    col: data.from.col
                };
                const toPos = {
                    row: data.to.row,
                    col: data.to.col
                };
                
                if (otherPlayer && (isWhitePlayer || isBlackPlayer)) {
                    console.log(`Forwarding move to ${isWhitePlayer ? 'BLACK' : 'WHITE'} player:`, fromPos, toPos);
                    this.sendToClient(otherPlayer, {
                        type: 'move',
                        from: fromPos,
                        to: toPos
                    });
                } else {
                    console.log(`Cannot forward move - other player not connected or sender is not a player`);
                }
                break;
            
            case 'game_over':
                // Handle checkmate, stalemate, or resignation
                const { result, winner } = data;
                console.log(`Game over in room ${roomId}: ${result}, winner: ${winner || 'none'}`);
                this.broadcastToRoom(roomId, {
                    type: 'game_end',
                    result: result, // 'checkmate', 'stalemate', or 'resignation'
                    winner: winner, // 'white' or 'black'
                    reason: `Game Over - ${result} ${winner ? `- ${winner} wins!` : ''}`
                });
                break;
            
            default:
                console.log(`Unknown message type in room ${roomId}: ${data.type}`);
        }
    }

    private handleDisconnection(ws: WebSocket, roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        let disconnectedColor: string | null = null;
        let disconnectedPlayer: 'white' | 'black' | null = null;

        // Determine which player disconnected
        if (room.players.white === ws) {
            disconnectedColor = 'white';
            disconnectedPlayer = 'white';
        } else if (room.players.black === ws) {
            disconnectedColor = 'black';
            disconnectedPlayer = 'black';
        } else {
            room.spectators = room.spectators.filter(spectator => spectator !== ws);
        }

        // Update last activity timestamp
        room.lastActivity = Date.now();

        // If a player disconnected, don't immediately remove them or notify others
        // Instead, set a timeout to allow for reconnection
        if (disconnectedPlayer) {
            console.log(`${disconnectedColor} player disconnected from room ${roomId} - waiting for reconnection`);
            
            // Store the disconnected WebSocket in a temporary variable
            const disconnectedWs = ws;
            
            // Set a timeout to check if the player reconnected
            setTimeout(() => {
                // Check if the room still exists
                const currentRoom = this.rooms.get(roomId);
                if (!currentRoom) return;
                
                // Check if the player is still disconnected (same WebSocket instance)
                const isStillDisconnected = 
                    (disconnectedPlayer === 'white' && currentRoom.players.white === disconnectedWs) || 
                    (disconnectedPlayer === 'black' && currentRoom.players.black === disconnectedWs);
                    
                if (isStillDisconnected) {
                    // Now actually remove the player
                    if (disconnectedPlayer === 'white') {
                        currentRoom.players.white = undefined;
                    } else if (disconnectedPlayer === 'black') {
                        currentRoom.players.black = undefined;
                    }
                    
                    // Notify remaining players
                    console.log(`${disconnectedColor} player did not reconnect to room ${roomId}`);
                    this.broadcastToRoom(roomId, {
                        type: 'game_end',
                        reason: `${disconnectedColor} player disconnected`
                    });
                    
                    // Clean up empty rooms
                    if (!currentRoom.players.white && !currentRoom.players.black && currentRoom.spectators.length === 0) {
                        console.log(`Room ${roomId} is empty, removing it`);
                        this.rooms.delete(roomId);
                    }
                }
            }, 10000); // 10 second grace period for reconnection
        } else {
            // For spectators, just clean up empty rooms immediately
            if (!room.players.white && !room.players.black && room.spectators.length === 0) {
                console.log(`Room ${roomId} is empty, removing it`);
                this.rooms.delete(roomId);
            }
        }
    }

    private sendToClient(ws: WebSocket, data: any) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                const message = JSON.stringify(data);
                console.log(`Sending to client: ${message}`);
                ws.send(message);
            } catch (error) {
                console.error('Error sending message to client:', error);
            }
        } else {
            console.log(`Cannot send message - client connection not open (state: ${ws.readyState})`);
        }
    }

    private broadcastToRoom(roomId: string, data: any) {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.log(`Cannot broadcast - room ${roomId} not found`);
            return;
        }

        console.log(`Broadcasting to room ${roomId}: ${JSON.stringify(data)}`);
        const message = JSON.stringify(data);
        
        let sentCount = 0;
        if (room.players.white?.readyState === WebSocket.OPEN) {
            room.players.white.send(message);
            sentCount++;
        }
        if (room.players.black?.readyState === WebSocket.OPEN) {
            room.players.black.send(message);
            sentCount++;
        }
        room.spectators.forEach(spectator => {
            if (spectator.readyState === WebSocket.OPEN) {
                spectator.send(message);
                sentCount++;
            }
        });
        
        console.log(`Broadcast sent to ${sentCount} clients in room ${roomId}`);
    }

    private getReadyStateString(readyState: number): string {
        switch (readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return `UNKNOWN (${readyState})`;
        }
    }
}

function extractRoomId(roomId: string): string {
    // Handle URL-encoded room IDs
    if (roomId.includes('%3D')) {
        roomId = decodeURIComponent(roomId);
    }

    // Extract room ID from different formats
    let extractedId = roomId;
    if (roomId.includes('?ROOMID=')) {
        extractedId = roomId.split('?ROOMID=')[1];
    } else if (roomId.includes('?roomId=')) {
        extractedId = roomId.split('?roomId=')[1];
    } else if (roomId.includes('roomId=')) {
        extractedId = roomId.split('roomId=')[1];
    }

    // Remove any query parameters or fragments
    if (extractedId.includes('&')) {
        extractedId = extractedId.split('&')[0];
    }
    if (extractedId.includes('#')) {
        extractedId = extractedId.split('#')[0];
    }

    // Remove any non-alphanumeric characters and normalize to uppercase
    extractedId = extractedId.replace(/[^A-Z0-9]/gi, '').toUpperCase();

    // Validate length (6-12 characters)
    if (extractedId.length < 6 || extractedId.length > 12) {
        console.error('Invalid room ID length:', extractedId);
        return '';
    }

    return extractedId;
}