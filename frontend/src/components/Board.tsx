  import React, { useState} from 'react';
  import Square from './Square';
  import Piece from './Piece';
  import { ChessBoard, Position, Color } from '../lib/ChessLogic';

  const Board: React.FC = () => {
    const [game] = useState(new ChessBoard());
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
    const [legalMoves, setLegalMoves] = useState<Position[]>([]);
    // Add a state to force re-renders
    const [boardState, setBoardState] = useState<number>(0);

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
      const piece = board[position.row][position.col];

      if (selectedPosition) {
        // If a piece is already selected, try to move it
        if (legalMoves.some(move => move.row === position.row && move.col === position.col)) {
          const success = game.makeMove(selectedPosition, position);
          if (success) {
            setSelectedPosition(null);
            setLegalMoves([]);
            // Force a re-render
            setBoardState(prev => prev + 1);
          }
        } else if (piece && piece.color === game.getCurrentTurn()) {
          // If clicking on another friendly piece, select it instead
          setSelectedPosition(position);
          const validMoves = game.getValidMovesForPiece(position);
          setLegalMoves(validMoves.map(move => move.to));
        } else {
          // If clicking on an invalid square, deselect
          setSelectedPosition(null);
          setLegalMoves([]);
        }
      } else {
        // If no piece is selected, try to select one
        if (piece && piece.color === game.getCurrentTurn()) {
          setSelectedPosition(position);
          const validMoves = game.getValidMovesForPiece(position);
          setLegalMoves(validMoves.map(move => move.to));
        }
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

    // Add game status display
    const getGameStatus = () => {
      if (game.isCheckmate()) {
        const winner = game.getCurrentTurn() === Color.WHITE ? "Black" : "White";
        return `Checkmate! ${winner} wins!`;
      }
      if (game.isStalemate()) {
        return "Stalemate! Game is drawn.";
      }
      return `${game.getCurrentTurn() === Color.WHITE ? "White" : "Black"}'s turn`;
    };

    return (
      <div className="flex flex-col items-center">
        <div className="mb-4 text-xl font-bold">{getGameStatus()}</div>
        <div className="grid grid-cols-8 border-2 border-black" key={boardState}>
          {renderBoard()}
        </div>
      </div>
    );
  };

  export default Board;
