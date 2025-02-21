import React from 'react';
import { Piece as ChessPiece, PieceType, Color } from '../lib/ChessLogic';

interface PieceProps {
  piece: ChessPiece;
}

const pieceUnicode: { [key in PieceType]: { [key in Color]: string } } = {
  [PieceType.PAWN]: { [Color.WHITE]: '♙', [Color.BLACK]: '♟︎' },
  [PieceType.ROOK]: { [Color.WHITE]: '♖', [Color.BLACK]: '♜' },
  [PieceType.KNIGHT]: { [Color.WHITE]: '♘', [Color.BLACK]: '♞' },
  [PieceType.BISHOP]: { [Color.WHITE]: '♗', [Color.BLACK]: '♝' },
  [PieceType.QUEEN]: { [Color.WHITE]: '♕', [Color.BLACK]: '♛' },
  [PieceType.KING]: { [Color.WHITE]: '♔', [Color.BLACK]: '♚' },
};

const Piece: React.FC<PieceProps> = ({ piece }) => {
  const symbol = pieceUnicode[piece.type][piece.color];
  return <span className="text-3xl">{symbol}</span>;
};

export default Piece;
