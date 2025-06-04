import React, { useState, useEffect } from 'react';
import Board from './components/Board';
import GameModeSelector from './components/GameModeSelector';
import FileUpload from './components/FileUpload';

const App: React.FC = () => {
    const [gameStarted, setGameStarted] = useState(false);
    const [gameMode, setGameMode] = useState<'ai' | 'human' | 'online' | 'crypto' | null>(null);
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>();
    const [roomId, setRoomId] = useState<string>();

    // Check for roomId in URL when component mounts
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const roomIdParam = urlParams.get('roomId');
        
        if (roomIdParam) {
            // Normalize the room ID to uppercase
            const normalizedRoomId = roomIdParam.toUpperCase();
            console.log('Found roomId in URL:', normalizedRoomId);
            
            // Make it explicit that this is a joining request by using the roomId= prefix
            setRoomId(`roomId=${normalizedRoomId}`);
            setGameMode('online');
            setGameStarted(true);
            
            console.log('Joining room from URL parameter');
        }
    }, []);

    const handleModeSelect = (mode: 'ai' | 'human' | 'online' | 'crypto', diff?: 'easy' | 'medium' | 'hard', room?: string) => {
        console.log(`Mode selected: ${mode}, Difficulty: ${diff || 'N/A'}, Room: ${room || 'N/A'}`);
        setGameMode(mode);
        setDifficulty(diff);
        
        if (mode === 'online' && room) {
            // Check if this is a joining request (starts with roomId=)
            const isJoiningRequest = room.startsWith('roomId=');
            console.log(`Is joining request: ${isJoiningRequest}`);
            
            if (isJoiningRequest) {
                // For joining requests, keep the roomId= prefix intact
                setRoomId(room);
                
                // Extract just the room code for the URL
                const roomCode = room.substring(7).toUpperCase();
                
                // Update URL with roomId for sharing
                if (window.history.pushState) {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('roomId', roomCode);
                    window.history.pushState({ path: newUrl.href }, '', newUrl.href);
                    console.log('Updated URL with roomId:', roomCode);
                }
                
                console.log('Joining existing room with ID:', roomCode);
            } else {
                // For creating a new room, just use the room ID directly
                // IMPORTANT: Do NOT add roomId= prefix here - this ensures creator gets WHITE
                const normalizedRoomId = room.toUpperCase();
                setRoomId(normalizedRoomId);
                
                // Update URL with roomId for sharing
                if (window.history.pushState) {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('roomId', normalizedRoomId);
                    window.history.pushState({ path: newUrl.href }, '', newUrl.href);
                    console.log('Updated URL with roomId:', normalizedRoomId);
                }
                
                console.log('Created new room with ID:', normalizedRoomId);
            }
        }
        
        setGameStarted(true);
    };

    const handleEndGame = () => {
        setGameStarted(false);
        setGameMode(null);
        setDifficulty(undefined);
        setRoomId(undefined);
        
        // Remove roomId from URL
        if (window.history.pushState) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('roomId');
            window.history.pushState({ path: newUrl.href }, '', newUrl.href);
        }
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
