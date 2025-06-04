import React, { useState } from 'react';

interface GameModeSelectorProps {
    onModeSelect: (mode: 'ai' | 'human' | 'online' | 'crypto', difficulty?: 'easy' | 'medium' | 'hard', room?: string) => void;
}

const GameModeSelector: React.FC<GameModeSelectorProps> = ({ onModeSelect }) => {
    const [showDifficulty, setShowDifficulty] = useState(false);
    const [showRoomOptions, setShowRoomOptions] = useState(false);
    const [roomId, setRoomId] = useState('');
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);

    const handleAISelect = () => {
        setShowDifficulty(true);
    };

    const handleDifficultySelect = (difficulty: 'easy' | 'medium' | 'hard') => {
        onModeSelect('ai', difficulty);
    };

    const handleCreateRoom = () => {
        // Generate a random room ID (6 characters, uppercase letters and numbers)
        const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        setRoomId(newRoomId);
        console.log('Created room with ID:', newRoomId);
        
        // IMPORTANT: Do NOT add the roomId= prefix when creating a room
        // This ensures the creator will be assigned as WHITE
        onModeSelect('online', undefined, newRoomId);
        
        // Log to help with debugging
        console.log('Created new room without roomId= prefix');
    };

    const handleJoinRoom = () => {
        if (roomId.trim()) {
            // Normalize the room ID to uppercase and remove any non-alphanumeric characters
            const normalizedRoomId = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
            setRoomId(normalizedRoomId);
            console.log('Joining room with ID:', normalizedRoomId);
            
            // Make it very explicit that this is a joining request
            // This is important because the server uses this to determine if a player is joining vs creating
            onModeSelect('online', undefined, `roomId=${normalizedRoomId}`);
            
            // Log to help with debugging
            console.log('Sent joining request with roomId parameter');
        }
    };

    if (showRoomOptions) {
        return (
            <div className="relative min-h-screen w-full flex items-center justify-center">
                <div className="flex flex-col items-center space-y-6 max-w-sm mx-auto p-8 backdrop-blur-sm bg-white/5 rounded-2xl">
                    <h2 className="text-2xl font-light tracking-wide text-white">Online Game</h2>
                    {/* <button
                        className="w-full px-6 py-3 bg-white border-2 border-purple-500 text-purple-500 rounded-full hover:bg-purple-50 transition-colors duration-200"
                        onClick={() => onModeSelect('crypto')}
                    >
                        Crypto Mode
                    </button> */}
                    <button
                        className="w-full px-6 py-3 bg-white border-2 border-blue-500 text-blue-500 rounded-full hover:bg-blue-50 transition-colors duration-200"
                        onClick={handleCreateRoom}
                    >
                        Create Room
                    </button>
                    <div className="flex flex-col items-center space-y-3 w-full">
                        <input
                            type="text"
                            placeholder="Enter Room ID"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-full focus:outline-none focus:border-blue-500 transition-colors duration-200"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                        />
                        <button
                            className="w-full px-6 py-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors duration-200"
                            onClick={handleJoinRoom}
                        >
                            Join Room
                        </button>
                    </div>
                    <button
                        className="w-full px-6 py-3 border-2 border-gray-300 text-gray-600 rounded-full hover:bg-gray-50 transition-colors duration-200"
                        onClick={() => setShowRoomOptions(false)}
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    }

    if (showDifficulty) {
        return (
            <div className="relative min-h-screen w-full">
                {/* Video Background */}
                <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 to-gray-900/90 z-10"></div>
                    <div className="video-container">
                        <video 
                            autoPlay 
                            muted 
                            loop 
                            playsInline 
                            onLoadedData={() => setIsVideoLoaded(true)}
                            className={`video-background transition-opacity duration-1000 ${
                                isVideoLoaded ? 'opacity-30' : 'opacity-0'
                            }`}
                        >
                            <source src="/chess-bg.mp4" type="video/mp4" />
                        </video>
                    </div>
                </div>

                {/* Main content centered */}
                <div className="relative z-30 min-h-screen flex items-center justify-center">
                    <div className="backdrop-blur-sm bg-white/5 rounded-2xl">
                        <div className="flex flex-col items-center space-y-8 max-w-sm mx-auto p-10">
                            <h2 className="text-4xl font-light tracking-wide text-white mb-6">Select Difficulty</h2>
                            <button
                                className="w-full px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-emerald-500 text-white rounded-full hover:bg-emerald-500/20 transition-colors duration-200 text-xl"
                                onClick={() => handleDifficultySelect('easy')}
                            >
                                Easy
                            </button>
                            <button
                                className="w-full px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-amber-500 text-white rounded-full hover:bg-amber-500/20 transition-colors duration-200 text-xl"
                                onClick={() => handleDifficultySelect('medium')}
                            >
                                Medium
                            </button>
                            <button
                                className="w-full px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-rose-500 text-white rounded-full hover:bg-rose-500/20 transition-colors duration-200 text-xl"
                                onClick={() => handleDifficultySelect('hard')}
                            >
                                Hard
                            </button>
                            <button
                                className="w-full px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-gray-300 text-white rounded-full hover:bg-gray-400/20 transition-colors duration-200 text-xl"
                                onClick={() => setShowDifficulty(false)}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen w-full">
            {/* Video Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-900/80 to-gray-900/90 z-10"></div>
                <div className="video-container">
                    <video 
                        autoPlay 
                        muted 
                        loop 
                        playsInline 
                        onLoadedData={() => setIsVideoLoaded(true)}
                        className={`video-background transition-opacity duration-1000 ${
                            isVideoLoaded ? 'opacity-30' : 'opacity-0'
                        }`}
                    >
                        <source src="/chess-bg.mp4" type="video/mp4" />
                    </video>
                </div>
            </div>

            {/* Main content centered */}
            <div className="relative z-30 min-h-screen flex items-center justify-center">
                <div className="backdrop-blur-sm bg-white/5 rounded-2xl">
                    <div className="flex flex-col items-center space-y-8 max-w-sm mx-auto p-10">
                        <h2 className="text-4xl font-light tracking-wide text-white mb-6">Select Game Mode</h2>
                        <button
                            className="w-full px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-indigo-500 text-white rounded-full hover:bg-indigo-500/20 transition-colors duration-200 text-xl"
                            onClick={() => onModeSelect('human')}
                        >
                            Online Mode
                        </button>
                        {/* <button
                            className="w-full px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-violet-500 text-white rounded-full hover:bg-violet-500/20 transition-colors duration-200 text-xl"
                            onClick={() => setShowRoomOptions(true)}
                        >
                            Online Game
                        </button> */}
                        <button
                            className="w-full px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-emerald-500 text-white rounded-full hover:bg-emerald-500/20 transition-colors duration-200 text-xl"
                            onClick={handleAISelect}
                        >
                            Local Game
                        </button>
                        <button
                            className="w-full px-8 py-4 bg-white/10 backdrop-blur-sm border-2 border-red-500 text-white rounded-full hover:bg-red-500/20 transition-colors duration-200 text-xl"
                            onClick={() => onModeSelect('crypto')}
                        >
                            Crypto Mode
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Updated styles with fixed video positioning
const styles = `
@keyframes floatChessPiece {
    0% {
        transform: translateY(100vh) rotate(0deg) scale(2);
    }
    100% {
        transform: translateY(-100px) rotate(360deg) scale(2);
    }
}

.chess-pieces-animation {
    position: fixed;
    width: 100%;
    height: 100%;
}

.chess-piece {
    position: absolute;
    font-size: 3rem;
    color: #1a1a1a;
    animation: floatChessPiece 15s linear infinite;
}

@keyframes slowZoom {
    0% {
        opacity: 0.4;
        transform: scale(1.1);
    }
    50% {
        opacity: 0.4;
        transform: scale(1.2);
    }
    100% {
        opacity: 0;
        transform: scale(1.3);
    }
}

@keyframes slowZoomDelayed {
    0% {
        opacity: 0;
        transform: scale(1.1);
    }
    50% {
        opacity: 0.4;
        transform: scale(1.2);
    }
    100% {
        opacity: 0;
        transform: scale(1.3);
    }
}

.chess-background {
    position: absolute;
    inset: 0;
    overflow: hidden;
}

video {
    min-width: 100%;
    min-height: 100%;
    width: auto;
    height: auto;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.animate-slow-zoom {
    animation: slowZoom 10s infinite;
}

.animate-slow-zoom-delayed {
    animation: slowZoomDelayed 10s infinite;
}

.video-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    z-index: 0;
}

.video-background {
    position: absolute;
    min-width: 100%;
    min-height: 100%;
    width: auto;
    height: auto;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(1.1);
    object-fit: cover;
}
`;

// Inject styles
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default GameModeSelector; 