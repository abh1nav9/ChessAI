// src/components/Board.tsx
import React, { useState } from 'react';
import { Chess, Square as ChessSquare } from 'chess.js';
import Square from './Square';
import Piece from './Piece';

const Board: React.FC = () => {
  // Initialize the chess game state
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<ChessSquare | null>(null);
  const [legalMoves, setLegalMoves] = useState<ChessSquare[]>([]);

  // Handle click events on squares
  const handleSquareClick = (square: ChessSquare) => {
    if (selectedSquare) {
      try {
        // Attempt to move the selected piece to the clicked square
        const move = game.move({ from: selectedSquare, to: square });
        if (move) {
          setGame(new Chess(game.fen()));
        }
      } catch (error) {
        // Invalid move, just clear selection
      }
      setSelectedSquare(null);
      setLegalMoves([]);
    } else {
      // Select a square if it has a piece for the current turn
      const moves = game.moves({ square: square, verbose: true });
      if (moves.length > 0) {
        setSelectedSquare(square);
        setLegalMoves(moves.map(m => m.to));
      }
    }
  };

  // Render the board using algebraic notation
  const renderBoard = () => {
    const squares = [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    // Iterate from rank 8 down to 1
    for (let rank = 8; rank >= 1; rank--) {
      for (let fileIndex = 0; fileIndex < 8; fileIndex++) {
        const file = files[fileIndex];
        const square = (file + rank) as ChessSquare;
        // Get the piece on this square (if any)
        const piece = game.get(square) || null;  // Convert undefined to null
        squares.push(
          <Square
            key={square}
            square={square}
            isSelected={selectedSquare === square}
            isLegalMove={legalMoves.includes(square)}
            onClick={() => handleSquareClick(square)}
          >
            {piece && <Piece piece={piece} />}
          </Square>
        );
      }
    }
    return squares;
  };

  return (
    <div className="grid grid-cols-8 border-2 border-black">
      {renderBoard()}
    </div>
  );
};

export default Board;
