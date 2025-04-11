import React, { useState } from 'react';
import Board from './components/Board';
import GameModeSelector from './components/GameModeSelector';
import FileUpload from './components/FileUpload';

const App: React.FC = () => {
    const [gameStarted, setGameStarted] = useState(false);
    const [gameMode, setGameMode] = useState<'ai' | 'human' | 'online' | 'crypto' | null>(null);
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>();
    const [roomId, setRoomId] = useState<string>();

    const handleModeSelect = (mode: 'ai' | 'human' | 'online' | 'crypto', diff?: 'easy' | 'medium' | 'hard', room?: string) => {
        setGameMode(mode);
        setDifficulty(diff);
        setRoomId(room);
        setGameStarted(true);
    };

    const handleEndGame = () => {
        setGameStarted(false);
        setGameMode(null);
        setDifficulty(undefined);
        setRoomId(undefined);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center">
            {!gameStarted ? (
                <GameModeSelector onModeSelect={handleModeSelect} />
            ) : gameMode === 'crypto' ? (
                <FileUpload />
            ) : (
                <Board
                    gameMode={gameMode!}
                    difficulty={difficulty}
                    roomId={roomId}
                    onEndGame={handleEndGame}
                />
            )}
        </div>
    );
};

export default App;
