// src/components/Square.tsx
import React from 'react';

interface SquareProps {
  square: string;
  isSelected: boolean;
  isLegalMove: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const Square: React.FC<SquareProps> = ({ square, isSelected, isLegalMove, onClick, children }) => {
  // Calculate square color using file and rank values
  const file = square.charAt(0);
  const rank = parseInt(square.charAt(1));
  const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
  // Adjust the formula for your desired color pattern (here, even sum is dark)
  const isDark = (fileIndex + rank) % 2 === 0;
  const baseColor = isDark ? 'bg-gray-500' : 'bg-white';
  const highlightColor = isSelected
    ? 'ring-4 ring-blue-500'
    : isLegalMove
    ? 'ring-4 ring-green-500'
    : '';
    
  return (
    <div
      onClick={onClick}
      className={`${baseColor} ${highlightColor} w-16 h-16 flex items-center justify-center cursor-pointer`}
    >
      {children}
    </div>
  );
};

export default Square;
