import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import gameRoutes from '../src/routes/gameRoutes';

// Create express app for testing
const app = express();
app.use(express.json());
app.use(cors());
app.use('/api/game', gameRoutes);

// Mock the game controller
jest.mock('../src/controllers/gameController', () => ({
  startNewGame: jest.fn((req, res) => {
    return res.status(200).json({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      isGameOver: false
    });
  }),
  makeMove: jest.fn((req, res) => {
    if (req.body.move === 'invalid') {
      return res.status(400).json({
        error: 'Invalid move',
        isValidMove: false
      });
    }
    return res.status(200).json({
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      isValidMove: true,
      isGameOver: false
    });
  }),
  getAiMove: jest.fn((req, res) => {
    return res.status(200).json({
      move: 'e5',
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
    });
  }),
  analyzeGame: jest.fn((req, res) => {
    return res.status(200).json({
      evaluation: 0.5,
      bestMove: 'e4'
    });
  })
}));

describe('Game API Routes', () => {
  describe('POST /api/game/new', () => {
    it('should return a new game', async () => {
      const response = await request(app)
        .post('/api/game/new')
        .send({});
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fen');
      expect(response.body).toHaveProperty('isGameOver');
    });
  });

  describe('POST /api/game/move', () => {
    it('should make a valid move', async () => {
      const response = await request(app)
        .post('/api/game/move')
        .send({
          move: 'e4',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('fen');
      expect(response.body).toHaveProperty('isValidMove', true);
    });

    it('should reject an invalid move', async () => {
      const response = await request(app)
        .post('/api/game/move')
        .send({
          move: 'invalid',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('isValidMove', false);
    });
  });

  describe('POST /api/game/ai-move', () => {
    it('should return an AI move', async () => {
      const response = await request(app)
        .post('/api/game/ai-move')
        .send({
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
          depth: 2
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('move');
      expect(response.body).toHaveProperty('fen');
    });
  });

  describe('POST /api/game/analyze', () => {
    it('should return game analysis', async () => {
      const response = await request(app)
        .post('/api/game/analyze')
        .send({
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('evaluation');
      expect(response.body).toHaveProperty('bestMove');
    });
  });
}); 