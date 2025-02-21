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
  const file = square.charAt(0);
  const rank = parseInt(square.charAt(1));
  const isDark = (file.charCodeAt(0) - 'a'.charCodeAt(0) + rank) % 2 === 0;
  
  let className = `w-16 h-16 flex items-center justify-center cursor-pointer`;
  
  // Base color
  className += isDark ? ' bg-gray-400' : ' bg-white';
  
  // Highlight states
  if (isSelected) {
    className += ' ring-4 ring-blue-500';
  } else if (isLegalMove) {
    className += ' ring-4 ring-green-500';
  }

  return (
    <div onClick={onClick} className={className}>
      {children}
    </div>
  );
};

export default Square;
