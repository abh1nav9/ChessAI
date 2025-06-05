import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChessBoard from '../components/ChessBoard';

// Mock the chess.js module
vi.mock('chess.js', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      move: vi.fn(),
      fen: vi.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      isGameOver: vi.fn().mockReturnValue(false),
      isDraw: vi.fn().mockReturnValue(false),
      isCheckmate: vi.fn().mockReturnValue(false),
      inCheck: vi.fn().mockReturnValue(false),
      history: vi.fn().mockReturnValue([]),
      turn: vi.fn().mockReturnValue('w')
    }))
  };
});

describe('ChessBoard Component', () => {
  it('renders the chess board correctly', () => {
    render(<ChessBoard />);
    const board = screen.getByTestId('chess-board');
    expect(board).toBeInTheDocument();
  });

  it('allows pieces to be selected', () => {
    render(<ChessBoard />);
    const pawn = screen.getByTestId('square-e2');
    fireEvent.click(pawn);
    expect(pawn).toHaveClass('selected');
  });

  it('shows valid moves when a piece is selected', () => {
    render(<ChessBoard />);
    const pawn = screen.getByTestId('square-e2');
    fireEvent.click(pawn);
    const validMove = screen.getByTestId('square-e4');
    expect(validMove).toHaveClass('valid-move');
  });

  it('makes a move when a valid destination is clicked', () => {
    render(<ChessBoard />);
    const pawn = screen.getByTestId('square-e2');
    fireEvent.click(pawn);
    const destination = screen.getByTestId('square-e4');
    fireEvent.click(destination);
    // Assert the state has changed appropriately
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Black to move');
  });
}); 