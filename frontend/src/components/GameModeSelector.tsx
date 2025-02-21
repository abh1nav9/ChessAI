import React, { useState } from 'react';

interface GameModeSelectorProps {
    onModeSelect: (mode: 'ai' | 'human' | 'online', difficulty?: 'easy' | 'medium' | 'hard', roomId?: string) => void;
}

const GameModeSelector: React.FC<GameModeSelectorProps> = ({ onModeSelect }) => {
    const [showDifficulty, setShowDifficulty] = useState(false);
    const [showRoomOptions, setShowRoomOptions] = useState(false);
    const [roomId, setRoomId] = useState('');

    const handleAISelect = () => {
        setShowDifficulty(true);
    };

    const handleDifficultySelect = (difficulty: 'easy' | 'medium' | 'hard') => {
        onModeSelect('ai', difficulty);
    };

    const handleCreateRoom = () => {
        // Generate a random room ID
        const newRoomId = Math.random().toString(36).substring(2, 8);
        onModeSelect('online', undefined, newRoomId);
    };

    const handleJoinRoom = () => {
        if (roomId.trim()) {
            onModeSelect('online', undefined, roomId.trim());
        }
    };

    if (showRoomOptions) {
        return (
            <div className="flex flex-col items-center space-y-4">
                <h2 className="text-2xl font-bold mb-4">Online Game</h2>
                <button
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 w-40"
                    onClick={handleCreateRoom}
                >
                    Create Room
                </button>
                <div className="flex flex-col items-center space-y-2">
                    <input
                        type="text"
                        placeholder="Enter Room ID"
                        className="px-4 py-2 border rounded w-40"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                    />
                    <button
                        className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 w-40"
                        onClick={handleJoinRoom}
                    >
                        Join Room
                    </button>
                </div>
                <button
                    className="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500 w-40"
                    onClick={() => setShowRoomOptions(false)}
                >
                    Back
                </button>
            </div>
        );
    }

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
                Local Game
            </button>
            <button
                className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 w-40"
                onClick={() => setShowRoomOptions(true)}
            >
                Online Game
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