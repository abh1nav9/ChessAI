import { Position } from '../lib/ChessLogic';

export class GameSocket {
    private socket!: WebSocket;
    private roomId: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private pingInterval: number | null = null;
    private callbacks: {
        onMove?: (from: Position, to: Position) => void;
        onPlayerJoined?: (color: 'white' | 'black') => void;
        onGameStart?: () => void;
        onGameEnd?: (reason: string) => void;
        onConnectionError?: (error: string) => void;
    } = {};

    constructor(roomId: string) {
        // Normalize room ID by extracting just the code from URLs or query parameters
        console.log(`Original roomId received: ${roomId}`);
        
        // First check if this is a joining format with roomId= prefix
        const isJoiningRoom = roomId.startsWith('roomId=');
        console.log(`Is joining room (from prefix): ${isJoiningRoom}`);
        
        // Extract the actual room ID
        if (roomId.startsWith('roomId=')) {
            this.roomId = roomId.substring(7).toUpperCase();
            console.log(`Extracted room ID from joining format: ${this.roomId}`);
        } else if (roomId.includes('?ROOMID=')) {
            this.roomId = roomId.split('?ROOMID=')[1].toUpperCase();
        } else if (roomId.includes('?roomId=')) {
            this.roomId = roomId.split('?roomId=')[1].toUpperCase();
        } else if (roomId.includes('roomId=')) {
            this.roomId = roomId.split('roomId=')[1].toUpperCase();
            // Remove any trailing parameters
            if (this.roomId.includes('&')) {
                this.roomId = this.roomId.split('&')[0];
            }
        } else if (roomId.includes('/')) {
            // Extract the last part of the path
            const parts = roomId.split('/');
            this.roomId = parts[parts.length - 1].toUpperCase();
            
            // If the last part is empty (URL ends with /), use the second-to-last part
            if (this.roomId === '' && parts.length > 1) {
                this.roomId = parts[parts.length - 2].toUpperCase();
            }
            
            // If the extracted part contains a query string, extract just the room ID
            if (this.roomId.includes('?ROOMID=')) {
                this.roomId = this.roomId.split('?ROOMID=')[1].toUpperCase();
            } else if (this.roomId.includes('?roomId=')) {
                this.roomId = this.roomId.split('?roomId=')[1].toUpperCase();
            }
        } else {
            // This is a direct room ID (creating a room)
            this.roomId = roomId.toUpperCase();
        }
        
        // Remove any trailing characters after the room code (6 characters is standard)
        if (this.roomId.length > 6) {
            // Try to find a 6-character alphanumeric sequence that looks like a room ID
            const match = this.roomId.match(/([A-Z0-9]{6})/);
            if (match) {
                this.roomId = match[1];
            } else {
                // If no match, just take the first 6 characters
                this.roomId = this.roomId.substring(0, 6);
            }
        }
        
        // Remove any non-alphanumeric characters
        this.roomId = this.roomId.replace(/[^A-Z0-9]/g, '');
        
        console.log(`Creating GameSocket with normalized roomId: ${this.roomId}`);
        console.log(`Connection mode: ${isJoiningRoom ? 'JOINING existing room' : 'CREATING new room'}`);
        
        // Pass the joining flag to connect method to ensure proper connection
        this.connect(isJoiningRoom);
    }

    private connect(isJoiningRoom: boolean = false) {
        // Use the current hostname instead of hardcoded localhost
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        const port = hostname === 'localhost' ? ':5000' : ''; // Use port 5000 for localhost, otherwise use default port
        
        // IMPORTANT: For joining existing rooms, use the same URL format as creating rooms
        // but add the roomId parameter to indicate this is a joining request
        const wsUrl = `${protocol}//${hostname}${port}/ws/game/${this.roomId}`;
        
        console.log(`Connecting to WebSocket at: ${wsUrl}`);
        console.log(`Connection type: ${isJoiningRoom ? 'Joining existing room' : 'Creating new room'}`);
        
        try {
            // Add protocols to indicate if this is a joining request
            // This is the critical part - we need to add the roomId= protocol for joining players
            const joinProtocol = isJoiningRoom ? `roomId=${this.roomId}` : undefined;
            
            // Close any existing connection before creating a new one
            if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
                console.log('Closing existing connection before reconnecting');
                this.socket.close();
            }
            
            // Create new WebSocket connection
            this.socket = new WebSocket(wsUrl, joinProtocol);
            
            console.log(`WebSocket created with protocol: ${isJoiningRoom ? joinProtocol : 'none'}`);
            
            this.socket.onopen = () => {
                console.log(`WebSocket Connected! Room: ${this.roomId}`);
                console.log(`Connection protocol: ${this.socket.protocol || 'none'}`);
                this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
                
                // Send a ping message to verify the connection
                setTimeout(() => {
                    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                        console.log('Sending ping to verify connection');
                        this.socket.send(JSON.stringify({ 
                            type: 'ping', 
                            roomId: this.roomId,
                            timestamp: Date.now(),
                            isJoining: isJoiningRoom // Explicitly indicate if this is a joining request
                        }));
                    } else {
                        console.error('Socket not open when trying to send ping');
                        // Try to reconnect if the socket isn't open
                        if (this.reconnectAttempts < this.maxReconnectAttempts) {
                            this.reconnectAttempts++;
                            console.log(`Socket not open, attempting reconnect #${this.reconnectAttempts}`);
                            setTimeout(() => this.connect(isJoiningRoom), 1000);
                        }
                    }
                }, 500); // Reduced delay for faster verification
                
                // Setup a regular ping to keep the connection alive
                this.setupKeepAlive();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket Error:', error);
                if (this.callbacks.onConnectionError) {
                    this.callbacks.onConnectionError('Connection error occurred. Please check if the server is running.');
                }
            };

            this.socket.onclose = (event) => {
                console.log(`WebSocket Closed: ${event.code} - ${event.reason}`);
                
                // Clear any existing ping interval when connection is closed
                if (this.pingInterval) {
                    clearInterval(this.pingInterval);
                    this.pingInterval = null;
                }
                
                // Don't attempt to reconnect if this was a normal closure or if max attempts reached
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    console.log(`Attempting to reconnect... (Attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                    this.reconnectAttempts++;
                    
                    // Use exponential backoff for reconnection attempts
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
                    console.log(`Reconnecting in ${delay/1000} seconds...`);
                    
                    // Preserve joining status when reconnecting
                    setTimeout(() => this.connect(isJoiningRoom), delay);
                    
                    // Notify the user that we're trying to reconnect
                    if (this.callbacks.onConnectionError) {
                        this.callbacks.onConnectionError(`Connection lost. Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
                    }
                } else if (event.code !== 1000 && this.callbacks.onGameEnd) {
                    this.callbacks.onGameEnd('Connection lost. Please try again.');
                }
            };

            this.setupSocketListeners();
        } catch (error) {
            console.error('Error creating WebSocket connection:', error);
            if (this.callbacks.onConnectionError) {
                this.callbacks.onConnectionError(`Failed to connect: ${error}`);
            }
        }
    }

    private setupSocketListeners() {
        if (!this.socket) {
            console.error('Socket is not initialized');
            return;
        }

        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received WebSocket message:', data);
                
                switch (data.type) {
                    case 'pong':
                        console.log('Received pong from server - connection confirmed');
                        break;
                        
                    case 'move':
                        if (this.callbacks.onMove && data.from && data.to) {
                            console.log('Processing move:', data.from, data.to);
                            this.callbacks.onMove(data.from, data.to);
                        } else {
                            console.error('Invalid move data received:', data);
                        }
                        break;
                        
                    case 'color_assigned':
                        if (this.callbacks.onPlayerJoined && data.color) {
                            console.log('Player joined/color assigned:', data.color);
                            this.callbacks.onPlayerJoined(data.color);
                            
                            // If this is a joining player (assigned black), we should assume the host is already there
                            // and trigger game_start automatically after a short delay
                            if (data.color === 'black') {
                                console.log('Assigned as BLACK - assuming host (WHITE) is already present');
                                setTimeout(() => {
                                    if (this.callbacks.onGameStart) {
                                        console.log('Auto-triggering game start for joining player');
                                        this.callbacks.onGameStart();
                                    }
                                }, 500);
                            }
                        } else {
                            console.error('Invalid color assignment data received:', data);
                        }
                        break;
                        
                    case 'color_confirmed':
                        console.log('Color confirmation received:', data.color);
                        if (this.callbacks.onPlayerJoined && data.color) {
                            // Send the color assignment again to ensure it's processed
                            this.callbacks.onPlayerJoined(data.color);
                        }
                        break;
                        
                    case 'opponent_reconnected':
                        console.log('Opponent reconnected:', data.color);
                        if (this.callbacks.onGameStart) {
                            // Treat reconnection as a game start event
                            console.log('Triggering game start due to opponent reconnection');
                            this.callbacks.onGameStart();
                        }
                        break;
                        
                    case 'game_start':
                        if (this.callbacks.onGameStart) {
                            console.log('Game start event received');
                            this.callbacks.onGameStart();
                        }
                        break;
                        
                    case 'game_end':
                        if (this.callbacks.onGameEnd) {
                            console.log('Game ended:', data.reason);
                            this.callbacks.onGameEnd(data.reason);
                        }
                        break;
                        
                    default:
                        console.log('Unknown message type:', data.type);
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        };
    }

    private setupKeepAlive() {
        // Clear any existing interval
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Send a ping every 15 seconds to keep the connection alive
        // This is more frequent than the previous 30 seconds to ensure the connection stays active
        this.pingInterval = window.setInterval(() => {
            if (this.socket) {
                if (this.socket.readyState === WebSocket.OPEN) {
                    console.log('Sending keepalive ping');
                    try {
                        this.socket.send(JSON.stringify({ 
                            type: 'ping', 
                            roomId: this.roomId,
                            timestamp: Date.now(),
                            keepalive: true
                        }));
                    } catch (error) {
                        console.error('Error sending keepalive ping:', error);
                        // If we can't send a ping, the connection might be dead
                        // Try to reconnect
                        if (this.reconnectAttempts < this.maxReconnectAttempts) {
                            console.log('Failed to send ping, attempting reconnect');
                            this.reconnectAttempts++;
                            this.connect();
                        }
                    }
                } else if (this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
                    console.log('Socket is closed/closing during keepalive check, attempting to reconnect');
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        this.connect();
                    }
                }
            }
        }, 15000); // 15 seconds instead of 30
    }

    public sendMove(from: Position, to: Position) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            // Ensure positions are proper objects with row and col properties
            const fromPos = {
                row: from.row,
                col: from.col
            };
            const toPos = {
                row: to.row,
                col: to.col
            };
            
            const message = {
                type: 'move',
                from: fromPos,
                to: toPos,
                roomId: this.roomId
            };
            console.log('Sending move:', message);
            this.socket.send(JSON.stringify(message));
        } else {
            console.error(`Cannot send move - WebSocket not connected. State: ${this.getReadyStateString()}`);
            if (this.callbacks.onConnectionError) {
                this.callbacks.onConnectionError('Connection lost - please refresh the page');
            }
        }
    }

    private getReadyStateString(): string {
        if (!this.socket) return 'SOCKET_NULL';
        
        switch (this.socket.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return `UNKNOWN (${this.socket.readyState})`;
        }
    }

    public onMove(callback: (from: Position, to: Position) => void) {
        this.callbacks.onMove = callback;
    }

    public onPlayerJoined(callback: (color: 'white' | 'black') => void) {
        this.callbacks.onPlayerJoined = callback;
    }

    public onGameEnd(callback: (reason: string) => void) {
        this.callbacks.onGameEnd = callback;
    }

    public onConnectionError(callback: (error: string) => void) {
        this.callbacks.onConnectionError = callback;
    }

    public onGameStart(callback: () => void) {
        this.callbacks.onGameStart = callback;
    }

    public disconnect() {
        console.log('Disconnecting WebSocket...');
        
        // Clear the ping interval when disconnecting
        if (this.pingInterval) {
            console.log('Clearing ping interval');
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        
        // Set reconnect attempts to max to prevent automatic reconnection
        this.reconnectAttempts = this.maxReconnectAttempts;
        
        // Only close the socket if it exists and is not already closed
        if (this.socket) {
            if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
                console.log('Closing WebSocket connection with code 1000 (Normal Closure)');
                try {
                    // Send a disconnect message to the server
                    this.socket.send(JSON.stringify({
                        type: 'disconnect',
                        roomId: this.roomId,
                        timestamp: Date.now()
                    }));
                    
                    // Use a clean close code (1000 = normal closure)
                    this.socket.close(1000, 'User initiated disconnect');
                } catch (error) {
                    console.error('Error during disconnect:', error);
                    // Force close if there was an error
                    try {
                        this.socket.close();
                    } catch (e) {
                        console.error('Error closing socket:', e);
                    }
                }
            } else {
                console.log(`Socket already in state: ${this.getReadyStateString()}`);
            }
            
            // Remove reference to the socket
            this.socket = null as any;
        } else {
            console.log('No active socket to disconnect');
        }
    }

    public sendGameOver(result: 'checkmate' | 'stalemate' | 'resignation', winner: 'white' | 'black' | null) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'game_over',
                result,
                winner,
                roomId: this.roomId
            };
            console.log('Sending game over:', message);
            this.socket.send(JSON.stringify(message));
        }
    }
} 