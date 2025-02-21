import React, { useState } from 'react';
import Board from './components/Board';
import GameModeSelector from './components/GameModeSelector';

const App: React.FC = () => {
    const [gameMode, setGameMode] = useState<'ai' | 'human' | null>(null);
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

    const handleModeSelect = (mode: 'ai' | 'human', diff?: 'easy' | 'medium' | 'hard') => {
        setGameMode(mode);
        if (diff) {
            setDifficulty(diff);
        }
    };

    if (!gameMode) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
                <h1 className="text-4xl font-bold mb-8">Chess Game</h1>
                <GameModeSelector onModeSelect={handleModeSelect} />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
            <h1 className="text-4xl font-bold mb-8">Chess Game</h1>
            <Board gameMode={gameMode} difficulty={difficulty} />
        </div>
    );
};

export default App;
