import React, { useState, useEffect } from 'react';
import Square from './Square';
import Piece from './Piece';
import { ChessBoard, Position, Color, Move } from '../lib/ChessLogic';
import { GameSocket } from '../services/GameSocket';
import { Dialog } from '@headlessui/react';
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
    const [isAIThinking, setIsAIThinking] = useState(false);
    const [aiProvider, setAiProvider] = useState<'OpenAI' | 'Gemini' | 'Stockfish' | null>(null);
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
    const [stockfish, setStockfish] = useState<StockfishService | null>(null);

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

    useEffect(() => {
        if (gameMode === 'competitive') {
            setPlayerColor(Color.WHITE);
            const sf = new StockfishService();
            setStockfish(sf);
            setAiProvider('Stockfish');
            return () => sf.destroy();
        }
    }, [gameMode]);

    // Combine the AI move functions into one
    const makeAIMove = async () => {
        setIsAIThinking(true);
        try {
            if (gameMode === 'competitive' && stockfish) {
                const fen = game.toFEN();
                console.log('Sending position to Stockfish:', fen);
                const move = await stockfish.getNextMove(fen);
                console.log('Received move from Stockfish:', move);
                const success = game.makeMove(move.from, move.to);
                if (success) {
                    setBoardState(prev => prev + 1);
                    setAiProvider('Stockfish');
                } else {
                    console.error('Invalid Stockfish move:', move);
                }
            } else if (gameMode === 'ai') {
                // Regular AI logic
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
        }
      } catch (error) {
            console.error('Error making AI move:', error);
        } finally {
            setIsAIThinking(false);
        }
    };

    // Remove the separate makeStockfishMove function and update the useEffect
    useEffect(() => {
        if ((gameMode === 'ai' || gameMode === 'competitive') && 
            game.getCurrentTurn() === Color.BLACK && 
            !gameResult.result) {
            makeAIMove();
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

        if (gameMode === 'competitive') {
            if (isAIThinking) {
                return "Stockfish is thinking...";
            }
            return `Your turn (White)${game.getCurrentTurn() === Color.BLACK ? ' - Stockfish is thinking...' : ''}`;
        }

        return `Current Turn: ${game.getCurrentTurn() === Color.WHITE ? 'White' : 'Black'}`;
    };

    const getProviderBadgeClass = () => {
        if (!aiProvider) return '';
        return aiProvider === 'OpenAI' 
            ? 'bg-green-500'
            : aiProvider === 'Gemini' 
                ? 'bg-blue-500'
                : 'bg-purple-500';
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

    // Helper function to convert move to algebraic notation
    const toAlgebraicNotation = (move: Move): string => {
        const from = toSquare(move.from);
        const to = toSquare(move.to);
        return `${from}-${to}`;
    };

  return (
        <div className="relative min-h-screen w-full bg-[#1a1a1a]">
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-transparent"></div>

            <div className="relative z-10 flex items-center justify-center gap-24 min-h-screen p-8">
                <div className="flex flex-col items-center">
                    <div className="mb-6 text-2xl font-light text-white/90">
                        {isAIThinking ? "AI is thinking..." : getGameStatus()}
                    </div>

                    <div className="flex bg-[#242424] p-6 rounded-xl">
                        <div className="flex flex-col justify-center mr-2">
                            {[8,7,6,5,4,3,2,1].map((number) => (
                                <div key={number} className="h-20 flex items-center justify-center text-white/70 font-medium text-xl">
                                    {number}
                                </div>
                            ))}
                        </div>

                        <div>
                            <div className="grid grid-cols-8 border border-gray-600" style={{ width: '640px', height: '640px' }}>
      {renderBoard()}
                            </div>

                            <div className="flex justify-around mt-2">
                                {['A','B','C','D','E','F','G','H'].map((letter) => (
                                    <div key={letter} className="w-20 text-center text-white/70 font-medium text-xl">
                                        {letter}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex gap-4">
                        {gameMode === 'online' && gameStarted && !gameResult.result && (
                            <button
                                onClick={handleResign}
                                className="px-6 py-3 bg-red-500/90 text-white rounded-lg hover:bg-red-600 text-lg transition-colors"
                            >
                                Resign
                            </button>
                        )}
                        <button
                            onClick={onEndGame}
                            className="px-6 py-3 bg-gray-700/90 text-white rounded-lg hover:bg-gray-600 text-lg transition-colors"
                        >
                            End Game
                        </button>
                    </div>
                </div>

                <div className="w-96 bg-[#242424] rounded-xl p-8 h-[640px] flex flex-col shadow-xl">
                    <h2 className="text-3xl font-light text-white/90 mb-6">Move History</h2>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: Math.ceil(game.moveHistory?.length / 2) }).map((_, index) => (
                                <React.Fragment key={index}>
                                    <div className="col-span-2 flex items-center text-xl text-white/80">
                                        <span className="w-12 text-white/40">{index + 1}.</span>
                                        <span className="flex-1">
                                            {game.moveHistory[index * 2] && 
                                                toAlgebraicNotation(game.moveHistory[index * 2])}
                                        </span>
                                        <span className="flex-1">
                                            {game.moveHistory[index * 2 + 1] && 
                                                toAlgebraicNotation(game.moveHistory[index * 2 + 1])}
                                        </span>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    {aiProvider && (
                        <div className="mt-4 text-sm text-white/50">
                            AI Powered by: {aiProvider}
                        </div>
                    )}
                </div>
            </div>

            {/* Add Stockfish badge for competitive mode */}
            {gameMode === 'competitive' && (
                <div className="fixed top-4 right-4 px-4 py-2 bg-red-600 text-white rounded-full font-semibold">
                    Playing against Stockfish
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
