import React, { useState, useEffect } from 'react';
import Square from './Square';
import Piece from './Piece';
import { ChessBoard, Position, Color, Move } from '../lib/ChessLogic';
import { GameSocket } from '../services/GameSocket';
import { Dialog } from '@headlessui/react';

interface BoardProps {
    gameMode: 'ai' | 'human' | 'online';
    difficulty?: 'easy' | 'medium' | 'hard';
    roomId?: string;
    onEndGame: () => void;
}

const Board: React.FC<BoardProps> = ({ gameMode, difficulty, roomId, onEndGame }) => {
    const [game] = useState(new ChessBoard());
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
    const [legalMoves, setLegalMoves] = useState<Position[]>([]);
    const [boardState, setBoardState] = useState<number>(0);
    const [isAIThinking, setIsAIThinking] = useState(false);
    const [aiProvider, setAiProvider] = useState<'OpenAI' | 'Gemini' | null>(null);
    const [gameSocket, setGameSocket] = useState<GameSocket | null>(null);
    const [playerColor, setPlayerColor] = useState<Color | null>(null);
    const [opponentJoined, setOpponentJoined] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [showGameStartPopup, setShowGameStartPopup] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [isHost, setIsHost] = useState(false);
    const [gameResult, setGameResult] = useState<{
        result: 'checkmate' | 'stalemate' | 'resignation' | null;
        winner: 'white' | 'black' | null;
    }>({ result: null, winner: null });

    useEffect(() => {
        if (gameMode === 'ai' && game.getCurrentTurn() === Color.BLACK) {
            makeAIMove();
        }
    }, [boardState, gameMode]);

    useEffect(() => {
        if (gameMode === 'online' && roomId) {
            console.log('Starting online game. Room ID:', roomId);
            setIsHost(!window.location.search.includes('roomId='));
            const socket = new GameSocket(roomId);
            
            socket.onPlayerJoined((color) => {
                console.log('Player color assigned:', color);
                setPlayerColor(color === 'white' ? Color.WHITE : Color.BLACK);
                setConnectionError(null);
            });

            socket.onGameStart(() => {
                console.log('Game starting');
                setOpponentJoined(true);
                setGameStarted(true);
                setShowGameStartPopup(true);
                setTimeout(() => setShowGameStartPopup(false), 3000);
            });

            socket.onMove((from, to) => {
                console.log('Opponent move received:', from, to);
                const success = game.makeMove(from, to);
                if (success) {
                    console.log('Move applied successfully');
                    setBoardState(prev => prev + 1);
                } else {
                    console.error('Failed to apply move');
                }
            });

            socket.onGameEnd((reason) => {
                console.log('Game ended:', reason);
                setOpponentJoined(false);
                setGameStarted(false);
                setPlayerColor(null);
                setConnectionError(`Game ended: ${reason}`);
            });

            socket.onConnectionError((error) => {
                console.error('Connection error:', error);
                setConnectionError(error);
            });

            setGameSocket(socket);

            return () => {
                console.log('Cleaning up game socket');
                socket.disconnect();
            };
        }
    }, [gameMode, roomId]);

    const makeAIMove = async () => {
        setIsAIThinking(true);
        try {
            const board = game.getBoard();
            const validMoves = getAllValidMoves(Color.BLACK);
            
            const response = await fetch('http://localhost:5000/api/ai/move', {
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
                setAiProvider(data.provider);
            }
        } catch (error) {
            console.error('Error making AI move:', error);
        } finally {
            setIsAIThinking(false);
        }
    };

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

        const board = game.getBoard();
        const piece = board[position.row][position.col];

        if (selectedPosition) {
            if (legalMoves.some(move => move.row === position.row && move.col === position.col)) {
                console.log('Making move:', selectedPosition, position);
                const success = game.makeMove(selectedPosition, position);
                if (success) {
                    if (gameMode === 'online' && gameSocket) {
                        console.log('Sending move to opponent');
                        gameSocket.sendMove(selectedPosition, position);
                    }
                    setSelectedPosition(null);
                    setLegalMoves([]);
                    setBoardState(prev => prev + 1);
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
      const squares = [];
      console.log('Rendering board state:', boardState);  // Optional, helps with debugging

      // Iterate from rank 8 down to 1 (row 7 to 0)
      for (let row = 7; row >= 0; row--) {
        for (let col = 0; col < 8; col++) {
          const square = toSquare({ row, col });
          const piece = board[row][col];
          
          squares.push(
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
        }
      }
      return squares;
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
            return `Playing as ${playerColor === Color.WHITE ? 'White' : 'Black'}`;
        }

        return `Current Turn: ${game.getCurrentTurn() === Color.WHITE ? 'White' : 'Black'}`;
    };

    const getProviderBadgeClass = () => {
        if (!aiProvider) return '';
        return aiProvider === 'OpenAI' 
            ? 'bg-green-500'
            : 'bg-blue-500';
    };

    const handleEndGame = () => {
        if (gameMode === 'online' && gameSocket) {
            gameSocket.disconnect();
        }
        onEndGame();
    };

    const handleCopyRoomId = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId);
            // Show temporary feedback
            const button = document.getElementById('copy-button');
            if (button) {
                const originalText = button.innerText;
                button.innerText = 'Copied!';
                setTimeout(() => {
                    button.innerText = originalText;
                }, 2000);
            }
        }
    };

    return (
      <div className="flex flex-col items-center">
        {gameMode === 'ai' && aiProvider && (
            <div className={`fixed top-4 right-4 px-4 py-2 rounded-full text-white font-semibold ${getProviderBadgeClass()}`}>
                {aiProvider}
            </div>
        )}
        {/* Online game status */}
        {gameMode === 'online' && (
            <div className="mb-4">
                <div className="text-lg font-bold text-center">
                    {!gameStarted ? (
                        <span className="text-blue-600">
                            {isHost ? 
                                "Waiting for opponent to join..." :
                                "Connecting to game..."}
                        </span>
                    ) : (
                        <div className="space-y-2">
                            <span>Playing as {playerColor === Color.WHITE ? 'White' : 'Black'}</span>
                            <div className="text-sm text-gray-600">
                                ({isHost ? 'Room Host' : 'Joined Player'})
                            </div>
                        </div>
                    )}
                </div>
                {roomId && !gameStarted && isHost && (
                    <div className="mt-2 p-4 bg-white rounded-lg shadow-md">
                        <div className="text-center mb-2">
                            <div className="font-semibold mb-1">Room Host</div>
                            <div className="mb-2">
                                <span className="font-semibold">Room ID: </span>
                                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                    {roomId}
                                </span>
                            </div>
                        </div>
                        <div className="flex gap-2 justify-center">
                            <button
                                id="copy-button"
                                onClick={handleCopyRoomId}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                                Copy Room ID
                            </button>
                        </div>
                    </div>
                )}
                {!isHost && !gameStarted && (
                    <div className="text-sm text-gray-600 text-center mt-2">
                        Joining Room: {roomId}
                    </div>
                )}
            </div>
        )}
        
        {/* Game start popup */}
        <Dialog
            open={showGameStartPopup}
            onClose={() => setShowGameStartPopup(false)}
            className="fixed inset-0 z-10 overflow-y-auto"
        >
            <div className="flex items-center justify-center min-h-screen">
                <div className="fixed inset-0 bg-black opacity-30" />
                <div className="relative bg-white rounded-lg p-8 max-w-md mx-auto text-center">
                    <Dialog.Title className="text-2xl font-bold mb-4">
                        Game Started!
                    </Dialog.Title>
                    <p className="mb-2">
                        {playerColor === Color.WHITE ? 
                            "You are playing as White" : 
                            "You are playing as Black"}
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                        {isHost ? '(Room Host)' : '(Joined Player)'}
                    </p>
                    <button
                        onClick={() => setShowGameStartPopup(false)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Got it!
                    </button>
                </div>
            </div>
        </Dialog>

        {/* Game status */}
        <div className="mb-4 text-xl font-bold">
            {isAIThinking ? "AI is thinking..." : getGameStatus()}
        </div>

        {/* Game end popup */}
        <Dialog
            open={gameResult.result !== null}
            onClose={() => {}}
            className="fixed inset-0 z-10 overflow-y-auto"
        >
            <div className="flex items-center justify-center min-h-screen">
                <div className="fixed inset-0 bg-black opacity-30" />
                <div className="relative bg-white rounded-lg p-8 max-w-md mx-auto text-center">
                    <Dialog.Title className="text-2xl font-bold mb-4">
                        Game Over!
                    </Dialog.Title>
                    <p className="mb-4 text-lg">
                        {gameResult.result === 'stalemate' ? (
                            'Game ended in Stalemate!'
                        ) : gameResult.result === 'resignation' ? (
                            `${gameResult.winner === 'white' ? 'White' : 'Black'} wins by resignation!`
                        ) : (
                            `${gameResult.winner === 'white' ? 'White' : 'Black'} wins by checkmate!`
                        )}
                    </p>
                    <button
                        onClick={onEndGame}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Return to Menu
                    </button>
                </div>
            </div>
        </Dialog>

        {/* Add connection error display */}
        {connectionError && (
            <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg">
                {connectionError}
            </div>
        )}

        {/* Existing board and end game button */}
        <div className="grid grid-cols-8 border-2 border-black" key={boardState}>
            {renderBoard()}
        </div>
        <div className="mt-6 flex gap-4">
            {gameMode === 'online' && gameStarted && !gameResult.result && (
                <button
                    onClick={handleResign}
                    className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                    Resign
                </button>
            )}
            <button
                onClick={onEndGame}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
                End Game
            </button>
        </div>
      </div>
    );
  };

  export default Board;
