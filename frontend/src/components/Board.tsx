import React, { useState } from 'react';
import Square from './Square';
import Piece from './Piece';
import { ChessBoard, Position } from '../lib/ChessLogic';

const Board: React.FC = () => {
  const [game] = useState(new ChessBoard());
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [legalMoves, setLegalMoves] = useState<Position[]>([]);

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
    const board = game.getBoard();

    if (selectedPosition) {
      // Attempt to move
      const success = game.makeMove(selectedPosition, position);
      if (success) {
        // Force re-render
        setSelectedPosition(null);
        setLegalMoves([]);
      } else {
        // Check if clicking on another own piece
        const piece = board[position.row][position.col];
        if (piece && piece.color === game.getCurrentTurn()) {
          setSelectedPosition(position);
          // Get valid moves for the new selected piece
          const validMoves = game.getValidMovesForPiece(position);
          setLegalMoves(validMoves.map(move => move.to));
        } else {
          setSelectedPosition(null);
          setLegalMoves([]);
        }
      }
    } else {
      // Select a piece
      const piece = board[position.row][position.col];
      if (piece && piece.color === game.getCurrentTurn()) {
        setSelectedPosition(position);
        const validMoves = game.getValidMovesForPiece(position);
        setLegalMoves(validMoves.map(move => move.to));
      }
    }
  };

  const renderBoard = () => {
    const squares = [];
    const board = game.getBoard();

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

  return (
    <div className="grid grid-cols-8 border-2 border-black">
      {renderBoard()}
    </div>
  );
};

export default Board;
