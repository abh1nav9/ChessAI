import { describe, it, expect, jest } from '@jest/globals';
import { Chess } from 'chess.js';
import { getBestMove, evaluatePosition, isGameOver } from '../src/services/chessEngine';

// Mock the chess.js module
jest.mock('chess.js', () => {
  return {
    Chess: jest.fn().mockImplementation(() => ({
      move: jest.fn(),
      fen: jest.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      isGameOver: jest.fn().mockReturnValue(false),
      isDraw: jest.fn().mockReturnValue(false),
      isCheckmate: jest.fn().mockReturnValue(false),
      inCheck: jest.fn().mockReturnValue(false),
      history: jest.fn().mockReturnValue([]),
      turn: jest.fn().mockReturnValue('w'),
      moves: jest.fn().mockReturnValue(['e4', 'e5', 'Nf3']),
      ascii: jest.fn().mockReturnValue('mock ascii board')
    }))
  };
});

describe('Chess Engine Service', () => {
  it('should return a valid move when getBestMove is called', async () => {
    const game = new Chess();
    const bestMove = await getBestMove(game, 2);
    expect(bestMove).toBeDefined();
    expect(typeof bestMove).toBe('string');
  });

  it('should evaluate the current position', () => {
    const game = new Chess();
    const evaluation = evaluatePosition(game);
    expect(evaluation).toBeDefined();
    expect(typeof evaluation).toBe('number');
  });

  it('should detect when a game is over', () => {
    const game = new Chess();
    // Mock the game to be over
    jest.spyOn(game, 'isGameOver').mockReturnValue(true);
    
    const result = isGameOver(game);
    expect(result).toBe(true);
  });

  it('should detect when a game is in checkmate', () => {
    const game = new Chess();
    // Mock the game to be in checkmate
    jest.spyOn(game, 'isGameOver').mockReturnValue(true);
    jest.spyOn(game, 'isCheckmate').mockReturnValue(true);
    
    const result = isGameOver(game);
    expect(result).toBe(true);
  });

  it('should handle invalid FEN strings', () => {
    expect(() => {
      const game = new Chess('invalid fen');
    }).toThrow();
  });
}); 