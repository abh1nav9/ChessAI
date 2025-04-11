import { Position, Move } from '../lib/ChessLogic';

export class StockfishService {
    private worker: Worker;
    private isReady: boolean = false;
    private resolveMove: ((move: { from: Position, to: Position }) => void) | null = null;

    constructor() {
        // Create a new worker with the correct path
        this.worker = new Worker('/stockfish/stockfish.js');
        this.init();
    }

    private init() {
        this.worker.onmessage = (e) => {
            const message = e.data as string;
            console.log('Stockfish message:', message);
            
            if (message === 'readyok') {
                console.log('Stockfish is ready');
                this.isReady = true;
            }
            
            if (typeof message === 'string' && message.startsWith('bestmove')) {
                const parts = message.split(' ');
                if (parts.length >= 2) {
                    const moveStr = parts[1];
                    console.log('Stockfish best move:', moveStr);
                    if (this.resolveMove && moveStr && moveStr !== '(none)') {
                        this.resolveMove(this.parseMoveString(moveStr));
                    }
                }
            }
        };

        this.worker.onerror = (e) => {
            console.error('Stockfish worker error:', e);
        };

        // Initialize engine with UCI commands
        const initCommands = [
            'uci',
            'setoption name Skill Level value 20',
            'setoption name MultiPV value 1',
            'setoption name Threads value 1',
            'setoption name Hash value 16',
            'isready'
        ];

        initCommands.forEach(cmd => {
            console.log('Sending command:', cmd);
            this.worker.postMessage(cmd);
        });
    }

    public async getNextMove(fen: string): Promise<{ from: Position, to: Position }> {
        if (!this.isReady) {
            console.log('Waiting for Stockfish to be ready...');
            await new Promise(resolve => {
                const checkReady = setInterval(() => {
                    if (this.isReady) {
                        clearInterval(checkReady);
                        resolve(true);
                    }
                }, 100);
            });
        }

        console.log('Getting next move for position:', fen);
        return new Promise((resolve) => {
            this.resolveMove = resolve;
            this.worker.postMessage('position fen ' + fen);
            this.worker.postMessage('go movetime 3000');
        });
    }

    private parseMoveString(moveStr: string): { from: Position, to: Position } {
        return {
            from: {
                row: 8 - parseInt(moveStr[1]),
                col: moveStr[0].charCodeAt(0) - 'a'.charCodeAt(0)
            },
            to: {
                row: 8 - parseInt(moveStr[3]),
                col: moveStr[2].charCodeAt(0) - 'a'.charCodeAt(0)
            }
        };
    }

    public destroy() {
        if (this.worker) {
            this.worker.terminate();
        }
    }
}

declare module 'stockfish.wasm' {
    interface StockfishEngine {
        postMessage(message: string): void;
        addMessageListener(callback: (message: string) => void): void;
    }

    // Support both default export and callable module
    const stockfish: {
        default?: () => Promise<StockfishEngine>;
        (): Promise<StockfishEngine>;
    };
    export = stockfish;
}
