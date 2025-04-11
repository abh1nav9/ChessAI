declare module 'stockfish.wasm' {
    interface StockfishEngine {
        postMessage(message: string): void;
        addMessageListener(callback: (message: string) => void): void;
    }

    const stockfish: () => Promise<StockfishEngine>;
    export = stockfish;
} 