// src/components/Piece.tsx
import React from 'react';
import { Piece as ChessPiece } from 'chess.js';

interface PieceProps {
  piece: ChessPiece;
}

const pieceUnicode: { [key: string]: { [color: string]: string } } = {
  p: { w: '♙', b: '♟︎' },
  r: { w: '♖', b: '♜' },
  n: { w: '♘', b: '♞' },
  b: { w: '♗', b: '♝' },
  q: { w: '♕', b: '♛' },
  k: { w: '♔', b: '♚' },
};

const Piece: React.FC<PieceProps> = ({ piece }) => {
  const symbol = pieceUnicode[piece.type]?.[piece.color];
  return <span className="text-3xl">{symbol}</span>;
};

export default Piece;
