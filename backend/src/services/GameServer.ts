import WebSocket from 'ws';
import { Server } from 'http';
import { Position } from '../types';

interface GameRoom {
    players: {
        white?: WebSocket;
        black?: WebSocket;
    };
    spectators: WebSocket[];
}

export class GameServer {
    private rooms: Map<string, GameRoom> = new Map();
    private wss: WebSocket.Server;

    constructor(server: Server) {
        this.wss = new WebSocket.Server({ server });
        this.setupWebSocketServer();
    }

    private setupWebSocketServer() {
        this.wss.on('connection', (ws: WebSocket, req: any) => {
            const roomId = this.getRoomIdFromUrl(req.url);
            if (!roomId) {
                ws.close();
                return;
            }

            console.log(`New connection to room: ${roomId}`);
            this.handleConnection(ws, roomId);
        });
    }

    private getRoomIdFromUrl(url: string): string | null {
        const match = url.match(/\/ws\/game\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    private handleConnection(ws: WebSocket, roomId: string) {
        let room = this.rooms.get(roomId);
        
        if (!room) {
            room = { players: {}, spectators: [] };
            this.rooms.set(roomId, room);
        }

        // Assign color to the player
        if (!room.players.white) {
            room.players.white = ws;
            this.sendToClient(ws, {
                type: 'color_assigned',
                color: 'white'
            });
        } else if (!room.players.black) {
            room.players.black = ws;
            this.sendToClient(ws, {
                type: 'color_assigned',
                color: 'black'
            });
            
            // When second player joins, notify both players that game is starting
            this.broadcastToRoom(roomId, {
                type: 'game_start'
            });
        } else {
            room.spectators.push(ws);
            this.sendToClient(ws, {
                type: 'spectator_joined'
            });
        }

        // Send current room state to the new player
        this.sendRoomState(ws, room);

        // Handle messages from the client
        ws.on('message', (message: string) => {
            try {
                const data = JSON.parse(message.toString()); // Convert Buffer to string
                this.handleMessage(ws, roomId, data);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });

        // Handle disconnection
        ws.on('close', () => {
            this.handleDisconnection(ws, roomId);
        });
    }

    private sendRoomState(ws: WebSocket, room: GameRoom) {
        // Let the client know if their opponent is already in the room
        if (room.players.white === ws && room.players.black) {
            this.sendToClient(ws, { type: 'game_start' });
        } else if (room.players.black === ws && room.players.white) {
            this.sendToClient(ws, { type: 'game_start' });
        }
    }

    private handleMessage(ws: WebSocket, roomId: string, data: any) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        switch (data.type) {
            case 'move':
                // Verify the move is coming from the correct player
                const isWhitePlayer = room.players.white === ws;
                const isBlackPlayer = room.players.black === ws;
                const otherPlayer = isWhitePlayer ? room.players.black : room.players.white;

                if (otherPlayer && (isWhitePlayer || isBlackPlayer)) {
                    console.log('Forwarding move:', data);
                    this.sendToClient(otherPlayer, {
                        type: 'move',
                        from: data.from,
                        to: data.to
                    });
                }
                break;
        }
    }

    private handleDisconnection(ws: WebSocket, roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        let disconnectedColor: string | null = null;

        // Remove the disconnected player and determine their color
        if (room.players.white === ws) {
            room.players.white = undefined;
            disconnectedColor = 'white';
        } else if (room.players.black === ws) {
            room.players.black = undefined;
            disconnectedColor = 'black';
        } else {
            room.spectators = room.spectators.filter(spectator => spectator !== ws);
        }

        // Notify remaining players
        if (disconnectedColor) {
            this.broadcastToRoom(roomId, {
                type: 'game_end',
                reason: `${disconnectedColor} player disconnected`
            });
        }

        // Clean up empty rooms
        if (!room.players.white && !room.players.black && room.spectators.length === 0) {
            this.rooms.delete(roomId);
        }
    }

    private sendToClient(ws: WebSocket, data: any) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(data));
            } catch (error) {
                console.error('Error sending message to client:', error);
            }
        }
    }

    private broadcastToRoom(roomId: string, data: any) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const message = JSON.stringify(data);
        
        if (room.players.white?.readyState === WebSocket.OPEN) {
            room.players.white.send(message);
        }
        if (room.players.black?.readyState === WebSocket.OPEN) {
            room.players.black.send(message);
        }
        room.spectators.forEach(spectator => {
            if (spectator.readyState === WebSocket.OPEN) {
                spectator.send(message);
            }
        });
    }
} 