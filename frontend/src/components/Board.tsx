import React, { useState, useEffect } from 'react';
import Square from './Square';
import Piece from './Piece';
import { ChessBoard, Position, Color, Move } from '../lib/ChessLogic';
import { GameSocket } from '../services/GameSocket';
import { StockfishService } from '../services/StockfishService';

interface BoardProps {
    gameMode: 'ai' | 'human' | 'online' | 'competitive';
    difficulty?: 'easy' | 'medium' | 'hard';
    roomId?: string;
    onEndGame: () => void;
}

const Board: React.FC<BoardProps> = ({ gameMode, difficulty, roomId, onEndGame }) => {
    const [game] = useState(new ChessBoard());
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
    const [legalMoves, setLegalMoves] = useState<Position[]>([]);
    const [boardState, setBoardState] = useState<number>(0);
    const [isBotThinking, setIsBotThinking] = useState(false);
    const [aiProvider, setAiProvider] = useState<'BOT' | null>(null);
    const [gameSocket, setGameSocket] = useState<GameSocket | null>(null);
    const [playerColor, setPlayerColor] = useState<Color | null>(null);
    const [opponentJoined, setOpponentJoined] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [showGameStartPopup, setShowGameStartPopup] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [gameResult, setGameResult] = useState<{
        result: 'checkmate' | 'stalemate' | 'resignation' | null;
        winner: 'white' | 'black' | null;
    }>({ result: null, winner: null });
    const [stockfish, setStockfish] = useState<StockfishService | null>(null);

    useEffect(() => {
        if (gameMode === 'ai' && game.getCurrentTurn() === Color.BLACK) {
            makeBotMove();
        }
    }, [boardState, gameMode]);

    useEffect(() => {
        if (gameMode === 'online' && roomId) {
            console.log('Starting online game. Original Room ID:', roomId);
            
            // Normalize room ID
            let normalizedRoomId = roomId;
            if (roomId.includes('?ROOMID=')) {
                normalizedRoomId = roomId.split('?ROOMID=')[1];
            } else if (roomId.includes('roomId=')) {
                normalizedRoomId = roomId.split('roomId=')[1];
                if (normalizedRoomId.includes('&')) {
                    normalizedRoomId = normalizedRoomId.split('&')[0];
                }
            } else if (roomId.includes('/')) {
                const parts = roomId.split('/');
                normalizedRoomId = parts[parts.length - 1];
                
                // If the extracted part contains a query string, extract just the room ID
                if (normalizedRoomId.includes('?ROOMID=')) {
                    normalizedRoomId = normalizedRoomId.split('?ROOMID=')[1];
                } else if (normalizedRoomId.includes('?roomId=')) {
                    normalizedRoomId = normalizedRoomId.split('?roomId=')[1];
                }
            }
            normalizedRoomId = normalizedRoomId.toUpperCase();
            
            console.log('Normalized Room ID:', normalizedRoomId);
            
            // Determine if this player is the host (creator) or the joiner
            // If the roomId was originally passed with 'roomId=' prefix, this is a joining player
            const isJoiningPlayer = roomId.includes('roomId=');
            setIsHost(!isJoiningPlayer);
            console.log(`Player role: ${isJoiningPlayer ? 'Joining existing room' : 'Creating new room'}`);
            
            // Reset state when connecting to a new room
            setOpponentJoined(false);
            setGameStarted(false);
            setPlayerColor(null);
            setConnectionError(null);
            setIsReconnecting(false);
            
            // If joining an existing room, show a connecting message
            if (isJoiningPlayer) {
                setConnectionError('Connecting to game...');
            }
            
            // Disconnect any existing socket before creating a new one
            if (gameSocket) {
                console.log('Disconnecting existing socket before creating a new one');
                gameSocket.disconnect();
                setGameSocket(null);
            }
            
            // Create a new GameSocket instance
            try {
                console.log(`Creating new GameSocket for room: ${normalizedRoomId}, isJoining: ${isJoiningPlayer}`);
                // Use the explicit joining format if this is a joining player
                const socketRoomId = isJoiningPlayer ? `roomId=${normalizedRoomId}` : normalizedRoomId;
                const socket = new GameSocket(socketRoomId);
                
                socket.onPlayerJoined((color) => {
                    console.log('Player color assigned:', color);
                    setPlayerColor(color === 'white' ? Color.WHITE : Color.BLACK);
                    setConnectionError(null);
                    setIsReconnecting(false);
                    
                    // If joining player, assume the game will start soon
                    // The host is already in the room
                    if (isJoiningPlayer) {
                        console.log('Joined as second player, assuming host is present');
                        setOpponentJoined(true);
                    }
                });

                socket.onGameStart(() => {
                    console.log('Game starting - opponent has joined');
                    setOpponentJoined(true);
                    setGameStarted(true);
                    setIsReconnecting(false);
                    setConnectionError(null);
                    setShowGameStartPopup(true);
                    setTimeout(() => setShowGameStartPopup(false), 3000);
                });

                socket.onMove((from, to) => {
                    console.log('Opponent move received:', from, to);
                    // Make sure the move is valid before applying it
                    try {
                        // Convert the positions to ensure they are proper objects
                        const fromPos = {
                            row: from.row,
                            col: from.col
                        };
                        const toPos = {
                            row: to.row,
                            col: to.col
                        };
                        
                        console.log('Applying move:', fromPos, toPos);
                        const success = game.makeMove(fromPos, toPos);
                        
                        if (success) {
                            console.log('Move applied successfully');
                            setBoardState(prev => prev + 1);
                            setConnectionError(null);
                        } else {
                            console.error('Failed to apply move - invalid move');
                        }
                    } catch (error) {
                        console.error('Error applying move:', error);
                    }
                });

                socket.onGameEnd((reason) => {
                    console.log('Game ended:', reason);
                    if (reason.includes('disconnected') && !reason.includes('did not reconnect')) {
                        // This is a temporary disconnection, show reconnecting state
                        setIsReconnecting(true);
                        setConnectionError('Opponent disconnected. Waiting for reconnection...');
                    } else {
                        // Game truly ended
                        setOpponentJoined(false);
                        setGameStarted(false);
                        setConnectionError(`Game ended: ${reason}`);
                        setIsReconnecting(false);
                    }
                });

                socket.onConnectionError((error) => {
                    console.error('Connection error:', error);
                    if (error.includes('Attempting to reconnect')) {
                        setIsReconnecting(true);
                    }
                    setConnectionError(error);
                });

                setGameSocket(socket);
                
                // Set a timeout to check if we've been assigned a color
                // If not, try reconnecting once
                const colorCheckTimeout = setTimeout(() => {
                    if (!playerColor) {
                        console.log('No color assigned after timeout, attempting to reconnect...');
                        setIsReconnecting(true);
                        setConnectionError('Connection issue. Attempting to reconnect...');
                        
                        // Disconnect the current socket
                        if (socket) {
                            socket.disconnect();
                        }
                        
                        // Wait a moment before reconnecting
                        setTimeout(() => {
                            // Try reconnecting with explicit joining flag if this is a joining player
                            console.log('Creating new socket after timeout');
                            const newSocket = new GameSocket(isJoiningPlayer ? `roomId=${normalizedRoomId}` : normalizedRoomId);
                            setGameSocket(newSocket);
                        }, 1000);
                    }
                }, 5000);

                return () => {
                    console.log('Cleaning up game socket');
                    clearTimeout(colorCheckTimeout);
                    if (socket) {
                        socket.disconnect();
                    }
                };
            } catch (error) {
                console.error('Error setting up game socket:', error);
                setConnectionError(`Failed to connect: ${error}`);
            }
        }
    }, [gameMode, roomId]);

    useEffect(() => {
        if (gameMode === 'competitive') {
            setPlayerColor(Color.WHITE);
            const sf = new StockfishService();
            setStockfish(sf);
            setAiProvider('BOT');
            return () => sf.destroy();
        }
    }, [gameMode]);

    // Combine the bot move functions into one
    const makeBotMove = async () => {
        setIsBotThinking(true);
        try {
            if (gameMode === 'competitive' && stockfish) {
                const fen = game.toFEN();
                console.log('Sending position to Stockfish:', fen);
                const move = await stockfish.getNextMove(fen);
                console.log('Received move from Stockfish:', move);
                const success = game.makeMove(move.from, move.to);
                if (success) {
                    setBoardState(prev => prev + 1);
                    setAiProvider('BOT');
                } else {
                    console.error('Invalid Stockfish move:', move);
                }
            } else if (gameMode === 'ai') {
                // Regular bot logic
                const board = game.getBoard();
                const validMoves = getAllValidMoves(Color.BLACK);
                
                const protocol = window.location.protocol;
                const hostname = window.location.hostname;
                const port = hostname === 'localhost' ? ':5000' : '';
                const apiUrl = `${protocol}//${hostname}${port}/api/ai/move`;
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        boardState: JSON.stringify(board),
                        validMoves: validMoves,
                        difficulty: difficulty || 'medium'
                    }),
                });

                const data = await response.json();
                if (data.move) {
                    game.makeMove(data.move.from, data.move.to);
                    setBoardState(prev => prev + 1);
                    setAiProvider('BOT');
                }
            }
        } catch (error) {
            console.error('Error making bot move:', error);
        } finally {
            setIsBotThinking(false);
        }
    };

    // Remove the separate makeStockfishMove function and update the useEffect
    useEffect(() => {
        if ((gameMode === 'ai' || gameMode === 'competitive') && 
            game.getCurrentTurn() === Color.BLACK && 
            !gameResult.result) {
            makeBotMove();
        }
    }, [boardState, gameMode]);

    const getAllValidMoves = (color: Color) => {
        const moves: Move[] = [];
        const board = game.getBoard();
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = board[row][col];
                if (piece && piece.color === color) {
                    const pieceMoves = game.getValidMovesForPiece({ row, col });
                    moves.push(...pieceMoves);
                }
            }
        }
        return moves;
    };

    // Convert algebraic notation to Position
    const toPosition = (square: string): Position => {
      const file = square.charAt(0).toLowerCase();
      const rank = parseInt(square.charAt(1));
      return {
        row: rank - 1,
        col: file.charCodeAt(0) - 'a'.charCodeAt(0)
      };
    };

    // Convert Position to algebraic notation
    const toSquare = (pos: Position): string => {
      const file = String.fromCharCode('a'.charCodeAt(0) + pos.col);
      const rank = pos.row + 1;
      return `${file}${rank}`;
    };

    const handleSquareClick = (square: string) => {
        const position = toPosition(square);
        
        if (gameMode === 'online') {
            // Add more detailed logging for online mode
            console.log('Square clicked:', square);
            console.log('Current turn:', game.getCurrentTurn());
            console.log('Player color:', playerColor);
            console.log('Opponent joined:', opponentJoined);

            if (!opponentJoined) {
                console.log('Waiting for opponent to join');
                return;
            }
            if (playerColor !== game.getCurrentTurn()) {
                console.log('Not your turn');
                return;
            }
        }

        if (gameMode === 'competitive') {
            // Only allow moves when it's player's turn (White)
            if (game.getCurrentTurn() !== Color.WHITE) {
                return;
            }
        }

        const board = game.getBoard();
        const piece = board[position.row][position.col];

        if (selectedPosition) {
            if (legalMoves.some(move => move.row === position.row && move.col === position.col)) {
                console.log('Making move:', selectedPosition, position);
                
                // Make a copy of the positions to ensure they are proper objects
                const fromPos = { ...selectedPosition };
                const toPos = { ...position };
                
                const success = game.makeMove(fromPos, toPos);
                if (success) {
                    if (gameMode === 'online' && gameSocket) {
                        console.log('Sending move to opponent:', fromPos, toPos);
                        try {
                            gameSocket.sendMove(fromPos, toPos);
                        } catch (error) {
                            console.error('Error sending move:', error);
                        }
                    }
                    setSelectedPosition(null);
                    setLegalMoves([]);
                    setBoardState(prev => prev + 1);
                } else {
                    console.error('Failed to apply move locally');
                }
            } else if (piece && piece.color === game.getCurrentTurn()) {
                setSelectedPosition(position);
                const validMoves = game.getValidMovesForPiece(position);
                setLegalMoves(validMoves.map(move => move.to));
            } else {
                setSelectedPosition(null);
                setLegalMoves([]);
            }
        } else if (piece && piece.color === game.getCurrentTurn()) {
            setSelectedPosition(position);
            const validMoves = game.getValidMovesForPiece(position);
            setLegalMoves(validMoves.map(move => move.to));
        }
    };

  const renderBoard = () => {
      // Use boardState in the function to avoid the unused variable warning
      const board = game.getBoard();
      console.log('Rendering board state:', boardState);  // Optional, helps with debugging

      // Determine if we should flip the board for black player
      const shouldFlipBoard = gameMode === 'online' && playerColor === Color.BLACK;
      
      // Create the chessboard container
      return (
        <div className="flex bg-[#242424] p-6 rounded-xl">
            <div className="flex flex-col justify-center mr-2">
                {(shouldFlipBoard ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1]).map((number) => (
                    <div key={number} className="h-20 flex items-center justify-center text-white/70 font-medium text-xl">
                        {number}
                    </div>
                ))}
            </div>

            <div>
                <div className="grid grid-cols-8 border border-gray-600" style={{ width: '640px', height: '640px' }}>
                    {/* Iterate from rank 8 down to 1 (row 7 to 0) or in reverse if flipped */}
                    {Array.from({ length: 8 }).map((_, rowIndex) => {
                        // If flipped, start from bottom (0) to top (7), else from top (7) to bottom (0)
                        const row = shouldFlipBoard ? rowIndex : 7 - rowIndex;
                        return Array.from({ length: 8 }).map((_, colIndex) => {
                            // If flipped, start from right (7) to left (0), else from left (0) to right (7)
                            const col = shouldFlipBoard ? 7 - colIndex : colIndex;
                            const square = toSquare({ row, col });
                            const piece = board[row][col];
                            
                            return (
                                <Square
                                    key={square}
                                    square={square}
                                    isSelected={selectedPosition?.row === row && selectedPosition?.col === col}
                                    isLegalMove={legalMoves.some(move => move.row === row && move.col === col)}
                                    onClick={() => handleSquareClick(square)}
                                >
                                    {piece && <Piece piece={piece} />}
                                </Square>
                            );
                        });
                    })}
                </div>

                <div className="flex justify-around mt-2">
                    {(shouldFlipBoard ? ['H','G','F','E','D','C','B','A'] : ['A','B','C','D','E','F','G','H']).map((letter) => (
                        <div key={letter} className="w-20 text-center text-white/70 font-medium text-xl">
                            {letter}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Move history */}
            <div className="ml-6 w-64 bg-[#1e1e1e] rounded-xl p-4 h-[640px] flex flex-col shadow-xl">
                <h2 className="text-xl font-light text-white/90 mb-4">Move History</h2>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: Math.ceil(game.getMoveHistory().length / 2) }).map((_, index) => (
                            <React.Fragment key={index}>
                                <div className="col-span-2 flex items-center text-lg text-white/80">
                                    <span className="w-8 text-white/40">{index + 1}.</span>
                                    <span className="flex-1">
                                        {game.getMoveHistory()[index * 2] && 
                                            toAlgebraicNotation(game.getMoveHistory()[index * 2])}
                                    </span>
                                    <span className="flex-1">
                                        {game.getMoveHistory()[index * 2 + 1] && 
                                            toAlgebraicNotation(game.getMoveHistory()[index * 2 + 1])}
                                    </span>
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
                {isBotThinking && (
                    <div className="mt-2 text-sm text-white/70 animate-pulse">
                        Bot is thinking...
                    </div>
                )}
            </div>
        </div>
      );
  };

    // Function to handle game end
    const handleGameEnd = (result: 'checkmate' | 'stalemate' | 'resignation', winner: 'white' | 'black' | null) => {
        setGameResult({ result, winner });
        if (gameSocket && gameMode === 'online') {
            gameSocket.sendGameOver(result, winner);
        }
    };

    // Check for checkmate or stalemate after each move
    useEffect(() => {
        if (game.isCheckmate()) {
            const winner = game.getCurrentTurn() === Color.WHITE ? 'black' : 'white';
            handleGameEnd('checkmate', winner);
        } else if (game.isStalemate()) {
            handleGameEnd('stalemate', null);
        }
    }, [boardState]);

    // Handle resignation
    const handleResign = () => {
        if (gameMode === 'online' && playerColor) {
            const winner = playerColor === Color.WHITE ? 'black' : 'white';
            handleGameEnd('resignation', winner);
        }
    };

    // Get game status message
    const getGameStatus = () => {
        if (isReconnecting) {
            return 'Reconnecting...';
        }

        if (gameResult.result) {
            switch (gameResult.result) {
                case 'checkmate':
                    return `Checkmate! ${gameResult.winner === 'white' ? 'White' : 'Black'} wins!`;
                case 'stalemate':
                    return 'Game Over - Stalemate!';
                case 'resignation':
                    return `Game Over - ${gameResult.winner === 'white' ? 'White' : 'Black'} wins by resignation!`;
                default:
                    return '';
            }
        }

        if (gameMode === 'online') {
            if (!gameStarted) {
                return isHost ? 'Waiting for opponent...' : 'Joining game...';
            }
            const isYourTurn = playerColor === game.getCurrentTurn();
            return `Playing as ${playerColor === Color.WHITE ? 'White' : 'Black'} - ${isYourTurn ? 'Your turn' : 'Opponent\'s turn'}`;
        }

        if (gameMode === 'competitive') {
            if (isBotThinking) {
                return "Stockfish is thinking...";
            }
            return `Your turn (White)${game.getCurrentTurn() === Color.BLACK ? ' - Bot is thinking...' : ''}`;
        }

        return `Current Turn: ${game.getCurrentTurn() === Color.WHITE ? 'White' : 'Black'}`;
    };

    const getProviderBadgeClass = () => {
        if (!aiProvider) return '';
        if (aiProvider === 'BOT') {
            return 'bg-green-500';
        } else {
            return 'bg-blue-500';
        }
    };

    const handleEndGame = () => {
        if (gameMode === 'online' && gameSocket) {
            gameSocket.disconnect();
        }
        onEndGame();
    };

    // Helper function to extract room ID from any URL format
    const extractRoomId = (url: string): string => {
        console.log(`Extracting room ID from: ${url}`);
        
        let roomId = url;
        
        // First check if this is a joining format with roomId= prefix
        if (roomId.startsWith('roomId=')) {
            roomId = roomId.substring(7);
            console.log(`Extracted from roomId= prefix: ${roomId}`);
        }
        
        // Handle full URLs with protocol and hostname
        if (roomId.includes('HTTP://') || roomId.includes('HTTPS://') || roomId.includes('http://') || roomId.includes('https://')) {
            // Extract just the path and query string
            const urlParts = roomId.split('//');
            if (urlParts.length > 1) {
                // Get everything after the hostname
                const hostAndPath = urlParts[1];
                const pathParts = hostAndPath.split('/');
                
                // If there's a path after the hostname
                if (pathParts.length > 1) {
                    // Check if there's a query string
                    const lastPart = pathParts[pathParts.length - 1];
                    if (lastPart.includes('?')) {
                        roomId = lastPart;
                    } else {
                        roomId = lastPart;
                    }
                } else if (pathParts[0].includes('?')) {
                    // Handle case where query is directly after hostname
                    roomId = pathParts[0].split('?')[1];
                }
            }
        }
        
        // Handle various query parameter formats
        if (roomId.includes('?ROOMID=')) {
            roomId = roomId.split('?ROOMID=')[1];
        } else if (roomId.includes('?roomId=')) {
            roomId = roomId.split('?roomId=')[1];
        } else if (roomId.includes('ROOMID=')) {
            roomId = roomId.split('ROOMID=')[1];
        } else if (roomId.includes('roomId=')) {
            roomId = roomId.split('roomId=')[1];
        }
        
        // Remove any trailing parameters
        if (roomId.includes('&')) {
            roomId = roomId.split('&')[0];
        }
        
        // Remove any non-alphanumeric characters
        roomId = roomId.replace(/[^a-zA-Z0-9]/g, '');
        
        // Ensure uppercase
        roomId = roomId.toUpperCase();
        
        // Look for a 6-character alphanumeric sequence that looks like a room ID
        const match = roomId.match(/([A-Z0-9]{6})/);
        if (match) {
            roomId = match[1];
        } else if (roomId.length > 6) {
            // If no match but string is longer than 6 chars, take the first 6
            roomId = roomId.substring(0, 6);
        }
        
        console.log(`Extracted room ID: ${roomId}`);
        return roomId;
    };

    // Update the renderRoomInfo function to include the force start button
    const renderRoomInfo = () => {
        if (gameMode === 'online' && roomId) {
            // Extract just the room code from the roomId if it contains a URL
            const displayRoomId = extractRoomId(roomId);
            const isJoiningPlayer = roomId.includes('roomId=');
                
            return (
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-lg border-2 border-blue-400">
                    <div className="text-base font-medium mb-1">Room ID: <span className="font-bold text-blue-600">{displayRoomId}</span></div>
                    <button 
                        onClick={handleCopyRoomId}
                        className="w-full mt-2 px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                        id="copy-button"
                    >
                        Copy Room Code
                    </button>
                    <div className="flex gap-2 mt-2">
                        <button 
                            onClick={handleDebugConnection}
                            className="flex-1 px-3 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
                        >
                            Debug
                        </button>
                        <button 
                            onClick={forceGameStart}
                            className="flex-1 px-3 py-2 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 transition-colors"
                        >
                            Force Start
                        </button>
                    </div>
                    {connectionError ? (
                        <div className="mt-2 text-sm text-red-600 font-medium">{connectionError}</div>
                    ) : !opponentJoined ? (
                        <div className="mt-2 text-sm text-orange-600 font-medium">
                            {isJoiningPlayer ? 'Connecting to game...' : 'Waiting for opponent to join...'}
                            {!isJoiningPlayer && (
                                <div className="mt-1 text-xs">
                                    Share the Room Code with your friend to play together
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="mt-2 text-sm text-green-600 font-medium">
                            {playerColor === Color.WHITE ? 'You play as White' : 'You play as Black'}
                            <div className="mt-1 text-xs">
                                Game in progress
                            </div>
                        </div>
                    )}
                    {isReconnecting && (
                        <div className="mt-2 text-sm text-blue-600 font-medium">
                            Reconnecting...
                        </div>
                    )}
                    {playerColor && (
                        <div className={`mt-2 text-sm font-medium ${playerColor === game.getCurrentTurn() ? 'text-green-600' : 'text-gray-600'}`}>
                            {playerColor === game.getCurrentTurn() ? 'Your turn' : "Opponent's turn"}
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    const handleCopyRoomId = () => {
        if (roomId) {
            // Extract just the room code if roomId contains a URL
            const roomCode = extractRoomId(roomId);
            
            // Copy just the room code to clipboard, not the full URL
            navigator.clipboard.writeText(roomCode)
                .then(() => {
                    // Show temporary feedback
                    const button = document.getElementById('copy-button');
                    if (button) {
                        const originalText = button.innerText;
                        button.innerText = 'Copied!';
                        button.classList.add('bg-green-500');
                        button.classList.remove('bg-blue-500');
                        setTimeout(() => {
                            button.innerText = originalText;
                            button.classList.add('bg-blue-500');
                            button.classList.remove('bg-green-500');
                        }, 2000);
                    }
                })
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    alert('Room code: ' + roomCode);
                });
        }
    };

    // Helper function to convert move to algebraic notation
    const toAlgebraicNotation = (move: Move): string => {
        const from = toSquare(move.from);
        const to = toSquare(move.to);
        return `${from}-${to}`;
    };

    // Add a function to force game start for testing
    const forceGameStart = () => {
        if (gameMode === 'online') {
            console.log('Forcing game start for testing purposes only');
            
            // Show a warning that this is for testing only
            const warningMessage = 'WARNING: This is for testing only. The game will start in single-player mode with no actual opponent.';
            console.warn(warningMessage);
            alert(warningMessage);
            
            // If we don't have a player color yet, assign one
            if (!playerColor) {
                console.log('Assigning default color: WHITE');
                setPlayerColor(Color.WHITE);
            }
            
            // Set opponent joined and game started flags
            setOpponentJoined(true);
            setGameStarted(true);
            
            // Show a notification
            setShowGameStartPopup(true);
            setTimeout(() => setShowGameStartPopup(false), 3000);
        }
    };

    // Update the debug function
    const handleDebugConnection = () => {
        if (gameMode === 'online') {
            console.log('Debug info:');
            console.log('Room ID:', roomId);
            console.log('Player color:', playerColor === Color.WHITE ? 'WHITE' : playerColor === Color.BLACK ? 'BLACK' : 'NONE');
            console.log('Current turn:', game.getCurrentTurn());
            console.log('Is your turn:', playerColor === game.getCurrentTurn());
            console.log('Opponent joined:', opponentJoined);
            console.log('Game started:', gameStarted);
            console.log('Is host:', isHost);
            console.log('Connection error:', connectionError);
            console.log('URL parameters:', window.location.search);
            
            // Log board state
            console.log('Board state:');
            const board = game.getBoard();
            for (let row = 7; row >= 0; row--) {
                let rowStr = '';
                for (let col = 0; col < 8; col++) {
                    const piece = board[row][col];
                    if (piece) {
                        const pieceChar = piece.color === Color.WHITE ? 
                            piece.type.charAt(0).toUpperCase() : 
                            piece.type.charAt(0).toLowerCase();
                        rowStr += pieceChar + ' ';
                    } else {
                        rowStr += '. ';
                    }
                }
                console.log(rowStr);
            }
            
            if (gameSocket) {
                console.log('Game socket exists');
                // Send a ping to verify connection
                try {
                    gameSocket.sendMove({ row: 0, col: 0 }, { row: 0, col: 0 });
                    console.log('Test move sent');
                    
                    // Show a temporary message on the screen
                    const debugInfo = document.createElement('div');
                    debugInfo.style.position = 'fixed';
                    debugInfo.style.top = '50%';
                    debugInfo.style.left = '50%';
                    debugInfo.style.transform = 'translate(-50%, -50%)';
                    debugInfo.style.backgroundColor = 'rgba(0,0,0,0.8)';
                    debugInfo.style.color = 'white';
                    debugInfo.style.padding = '20px';
                    debugInfo.style.borderRadius = '10px';
                    debugInfo.style.zIndex = '1000';
                    debugInfo.innerHTML = `
                        <h3>Debug Info</h3>
                        <p>Room ID: ${roomId}</p>
                        <p>Player color: ${playerColor === Color.WHITE ? 'WHITE' : playerColor === Color.BLACK ? 'BLACK' : 'NONE'}</p>
                        <p>Opponent joined: ${opponentJoined}</p>
                        <p>Game started: ${gameStarted}</p>
                        <p>Is host: ${isHost}</p>
                        <button id="reconnect-btn" style="background: #4CAF50; color: white; border: none; padding: 10px; border-radius: 5px; margin-top: 10px;">Reconnect</button>
                        <button id="close-debug" style="background: #f44336; color: white; border: none; padding: 10px; border-radius: 5px; margin-top: 10px; margin-left: 10px;">Close</button>
                    `;
                    document.body.appendChild(debugInfo);
                    
                    document.getElementById('reconnect-btn')?.addEventListener('click', () => {
                        // Try to reconnect
                        if (roomId) {
                            console.log('Manually reconnecting...');
                            if (gameSocket) {
                                gameSocket.disconnect();
                            }
                            const socket = new GameSocket(roomId);
                            setGameSocket(socket);
                            document.body.removeChild(debugInfo);
                        }
                    });
                    
                    document.getElementById('close-debug')?.addEventListener('click', () => {
                        document.body.removeChild(debugInfo);
                    });
                    
                    // Auto-remove after 30 seconds
                    setTimeout(() => {
                        if (document.body.contains(debugInfo)) {
                            document.body.removeChild(debugInfo);
                        }
                    }, 30000);
                    
                } catch (error) {
                    console.error('Error sending test move:', error);
                }
            } else {
                console.log('Game socket is null');
                // Try to reconnect
                if (roomId) {
                    console.log('Attempting to reconnect...');
                    const socket = new GameSocket(roomId);
                    setGameSocket(socket);
                }
            }
        }
    };

  return (
        <div className="relative min-h-screen w-full bg-[#1a1a1a]">
            <div className="absolute top-4 left-4 flex space-x-2">
                <button
                    onClick={handleEndGame}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                >
                    Exit Game
                </button>
                {gameMode === 'online' && playerColor && !connectionError && (
                    <button
                        onClick={handleResign}
                        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                    >
                        Resign
                    </button>
                )}
            </div>

            {renderRoomInfo()}

            {connectionError && gameMode === 'online' && (
                <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                        <h3 className="text-xl font-bold text-red-600 mb-2">Connection Error</h3>
                        <p className="mb-4">{connectionError}</p>
                        <div className="flex justify-end">
                            <button
                                onClick={handleEndGame}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                                Return to Menu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-center items-center min-h-screen">
                <div className="relative">
                    {renderBoard()}
                    
                    {/* Game status indicator */}
                    <div className="absolute -bottom-16 left-0 right-0 text-center text-white text-xl">
                        {getGameStatus()}
                    </div>
                    
                    {/* Bot Provider Badge */}
                    {aiProvider && (
                        <div className={`absolute top-2 left-2 px-3 py-1 rounded-full text-xs font-medium ${getProviderBadgeClass()}`}>
                            {aiProvider}
                        </div>
                    )}
                </div>
            </div>

            {/* Game Start Popup */}
            {showGameStartPopup && (
                <div className="fixed inset-0 flex items-center justify-center z-50">
                    <div className="bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-xl transform scale-110 animate-pulse">
                        <h2 className="text-2xl font-bold text-center">Game Started!</h2>
                        <p className="mt-2 text-center">
                            {playerColor === Color.WHITE ? "You're playing as White" : "You're playing as Black"}
                        </p>
                    </div>
                </div>
            )}
        </div>
  );
};

const styles = `
.custom-scrollbar::-webkit-scrollbar {
    width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #404040;
    border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #4a4a4a;
}
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default Board;
