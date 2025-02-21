import express from 'express';
import { getAIMove } from '../controller/aiController';

const router = express.Router();

router.post('/move', getAIMove);

export default router;
