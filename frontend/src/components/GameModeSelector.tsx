import React, { useState } from 'react';

interface GameModeSelectorProps {
    onModeSelect: (mode: 'ai' | 'human', difficulty?: 'easy' | 'medium' | 'hard') => void;
}

const GameModeSelector: React.FC<GameModeSelectorProps> = ({ onModeSelect }) => {
    const [showDifficulty, setShowDifficulty] = useState(false);

    const handleAISelect = () => {
        setShowDifficulty(true);
    };

    const handleDifficultySelect = (difficulty: 'easy' | 'medium' | 'hard') => {
        onModeSelect('ai', difficulty);
    };

    if (showDifficulty) {
        return (
            <div className="flex flex-col items-center space-y-4">
                <h2 className="text-2xl font-bold mb-4">Select Difficulty</h2>
                <button
                    className="px-6 py-3 bg-green-400 text-white rounded-lg hover:bg-green-500 w-40"
                    onClick={() => handleDifficultySelect('easy')}
                >
                    Easy
                </button>
                <button
                    className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 w-40"
                    onClick={() => handleDifficultySelect('medium')}
                >
                    Medium
                </button>
                <button
                    className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 w-40"
                    onClick={() => handleDifficultySelect('hard')}
                >
                    Hard
                </button>
                <button
                    className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 w-40"
                    onClick={() => setShowDifficulty(false)}
                >
                    Back
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center space-y-4">
            <h2 className="text-2xl font-bold mb-4">Select Game Mode</h2>
            <button
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 w-40"
                onClick={() => onModeSelect('human')}
            >
                Player vs Player
            </button>
            <button
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 w-40"
                onClick={handleAISelect}
            >
                Player vs AI
            </button>
        </div>
    );
};

export default GameModeSelector; 