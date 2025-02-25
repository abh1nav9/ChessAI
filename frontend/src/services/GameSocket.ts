import { Position } from '../lib/ChessLogic';

export class GameSocket {
    private socket!: WebSocket;
    private roomId: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 3;
    private callbacks: {
        onMove?: (from: Position, to: Position) => void;
        onPlayerJoined?: (color: 'white' | 'black') => void;
        onGameStart?: () => void;
        onGameEnd?: (reason: string) => void;
        onConnectionError?: (error: string) => void;
    } = {};

    constructor(roomId: string) {
        this.roomId = roomId;
        this.connect();
    }

    private connect() {
        this.socket = new WebSocket(`ws://localhost:5000/ws/game/${this.roomId}`);
        
        this.socket.onopen = () => {
            console.log('WebSocket Connected! Room:', this.roomId);
            this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        };

        this.socket.onerror = (error) => {
            console.error('WebSocket Error:', error);
            if (this.callbacks.onConnectionError) {
                this.callbacks.onConnectionError('Connection error occurred');
            }
        };

        this.socket.onclose = (event) => {
            console.log('WebSocket Closed:', event.reason);
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                console.log('Attempting to reconnect...');
                this.reconnectAttempts++;
                setTimeout(() => this.connect(), 2000); // Reconnect after 2 seconds
            } else if (this.callbacks.onGameEnd) {
                this.callbacks.onGameEnd('Connection lost');
            }
        };

        this.setupSocketListeners();
    }

    private setupSocketListeners() {
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received WebSocket message:', data);
                
                switch (data.type) {
                    case 'move':
                        if (this.callbacks.onMove && data.from && data.to) {
                            console.log('Processing move:', data.from, data.to);
                            this.callbacks.onMove(data.from, data.to);
                        }
                        break;
                    case 'color_assigned':
                        if (this.callbacks.onPlayerJoined && data.color) {
                            console.log('Player joined/color assigned:', data.color);
                            this.callbacks.onPlayerJoined(data.color);
                        }
                        break;
                    case 'game_start':
                        if (this.callbacks.onGameStart) {
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

    public sendMove(from: Position, to: Position) {
        if (this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type: 'move',
                from,
                to,
                roomId: this.roomId
            };
            console.log('Sending move:', message);
            this.socket.send(JSON.stringify(message));
        } else {
            console.error('Cannot send move - WebSocket not connected. State:', this.socket.readyState);
            if (this.callbacks.onConnectionError) {
                this.callbacks.onConnectionError('Connection lost - please refresh the page');
            }
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
        this.maxReconnectAttempts = 0; // Prevent reconnection attempts
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.close();
        }
    }

    public sendGameOver(result: 'checkmate' | 'stalemate' | 'resignation', winner: 'white' | 'black' | null) {
        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: 'game_over',
                result,
                winner,
                roomId: this.roomId
            }));
        }
    }
} 