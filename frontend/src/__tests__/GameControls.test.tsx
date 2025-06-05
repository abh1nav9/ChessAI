import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GameControls from '../components/GameControls';

describe('GameControls Component', () => {
  const mockNewGame = vi.fn();
  const mockUndo = vi.fn();
  const mockAiMove = vi.fn();
  const mockAnalyze = vi.fn();

  beforeEach(() => {
    render(
      <GameControls
        onNewGame={mockNewGame}
        onUndo={mockUndo}
        onAiMove={mockAiMove}
        onAnalyze={mockAnalyze}
        isGameOver={false}
        isAiThinking={false}
      />
    );
  });

  it('renders all control buttons', () => {
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ai move/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze/i })).toBeInTheDocument();
  });

  it('calls onNewGame when New Game button is clicked', () => {
    const newGameButton = screen.getByRole('button', { name: /new game/i });
    fireEvent.click(newGameButton);
    expect(mockNewGame).toHaveBeenCalledTimes(1);
  });

  it('calls onUndo when Undo button is clicked', () => {
    const undoButton = screen.getByRole('button', { name: /undo/i });
    fireEvent.click(undoButton);
    expect(mockUndo).toHaveBeenCalledTimes(1);
  });

  it('calls onAiMove when AI Move button is clicked', () => {
    const aiMoveButton = screen.getByRole('button', { name: /ai move/i });
    fireEvent.click(aiMoveButton);
    expect(mockAiMove).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when AI is thinking', () => {
    render(
      <GameControls
        onNewGame={mockNewGame}
        onUndo={mockUndo}
        onAiMove={mockAiMove}
        onAnalyze={mockAnalyze}
        isGameOver={false}
        isAiThinking={true}
      />
    );
    
    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /ai move/i })).toBeDisabled();
  });

  it('shows game over message when game is over', () => {
    render(
      <GameControls
        onNewGame={mockNewGame}
        onUndo={mockUndo}
        onAiMove={mockAiMove}
        onAnalyze={mockAnalyze}
        isGameOver={true}
        isAiThinking={false}
      />
    );
    
    expect(screen.getByText(/game over/i)).toBeInTheDocument();
  });
}); 