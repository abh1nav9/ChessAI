import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { startNewGame, makeMove, getAiMove, analyzeGame } from '../src/controllers/gameController';

// Mock request and response
const mockRequest = () => {
  const req: Partial<Request> = {
    body: {},
    params: {},
    query: {}
  };
  return req as Request;
};

const mockResponse = () => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };
  return res as Response;
};

// Mock chess engine service
jest.mock('../src/services/chessEngine', () => ({
  getBestMove: jest.fn().mockResolvedValue('e4'),
  evaluatePosition: jest.fn().mockReturnValue(0.5),
  isGameOver: jest.fn().mockReturnValue(false)
}));

describe('Game Controller', () => {
  let req: Request;
  let res: Response;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
  });

  describe('startNewGame', () => {
    it('should create a new game and return initial state', () => {
      startNewGame(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          fen: expect.any(String),
          isGameOver: false
        })
      );
    });
  });

  describe('makeMove', () => {
    it('should make a move and return updated game state', () => {
      req.body = { move: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' };
      
      makeMove(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          fen: expect.any(String),
          isValidMove: true
        })
      );
    });

    it('should return error for invalid move', () => {
      req.body = { move: 'invalid', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' };
      
      makeMove(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          isValidMove: false
        })
      );
    });
  });

  describe('getAiMove', () => {
    it('should return an AI move', async () => {
      req.body = { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: 2 };
      
      await getAiMove(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          move: expect.any(String),
          fen: expect.any(String)
        })
      );
    });
  });

  describe('analyzeGame', () => {
    it('should return game analysis', async () => {
      req.body = { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' };
      
      await analyzeGame(req, res);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          evaluation: expect.any(Number),
          bestMove: expect.any(String)
        })
      );
    });
  });
}); 