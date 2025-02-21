import { Request, Response } from 'express';
import { AIPlayer } from '../modal/aiModal';

const aiPlayer = new AIPlayer();

export const getAIMove = async (req: Request, res: Response) => {
    try {
        const { boardState, validMoves, difficulty } = req.body;
        const result = await aiPlayer.getNextMove(
            boardState, 
            validMoves, 
            difficulty || 'medium'
        );
        res.json(result);
    } catch (error) {
        console.error('Error in AI controller:', error);
        res.status(500).json({ 
            error: 'Error getting AI move',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
