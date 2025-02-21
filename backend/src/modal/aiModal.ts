import { PieceType, Color, Position, Move } from '../types';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Add a type for the AI response
export interface AIResponse {
    move: Move;
    provider: 'OpenAI' | 'Gemini';
}

export class AIPlayer {
    private openai: OpenAI | null = null;
    private genAI: GoogleGenerativeAI | null = null;
    private useGemini: boolean = false;

    constructor() {
        const openaiKey = process.env.OPENAI_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;
        
        if (!openaiKey && !geminiKey) {
            throw new Error('Neither OpenAI nor Gemini API keys are configured. Please set at least one in your environment variables.');
        }

        // Always try to initialize OpenAI first
        if (openaiKey) {
            this.openai = new OpenAI({
                apiKey: openaiKey
            });
        }

        // Initialize Gemini as backup
        if (geminiKey) {
            this.genAI = new GoogleGenerativeAI(geminiKey);
        }
    }

    async getNextMove(boardState: string, validMoves: Move[], difficulty: 'easy' | 'medium' | 'hard'): Promise<AIResponse> {
        // Always try OpenAI first if available
        if (this.openai) {
            try {
                const move = await this.getOpenAIMove(boardState, validMoves, difficulty);
                this.useGemini = false; // Reset Gemini flag on successful OpenAI call
                return { move, provider: 'OpenAI' };
            } catch (error) {
                console.log('OpenAI API failed:', error);
                // Only fall back to Gemini if OpenAI fails
                if (this.genAI) {
                    try {
                        const move = await this.getGeminiMove(boardState, validMoves, difficulty);
                        return { move, provider: 'Gemini' };
                    } catch (geminiError) {
                        console.error('Gemini API also failed:', geminiError);
                    }
                }
            }
        } else if (this.genAI) {
            // Use Gemini only if OpenAI is not available
            try {
                const move = await this.getGeminiMove(boardState, validMoves, difficulty);
                return { move, provider: 'Gemini' };
            } catch (error) {
                console.error('Gemini API failed:', error);
            }
        }

        // Ultimate fallback: return first valid move
        return { move: validMoves[0], provider: 'OpenAI' };
    }

    private async getOpenAIMove(boardState: string, validMoves: Move[], difficulty: 'easy' | 'medium' | 'hard'): Promise<Move> {
        if (!this.openai) {
            throw new Error('OpenAI not configured');
        }

        const prompt = this.getDifficultyPrompt(difficulty);
        const temperature = this.getDifficultyTemperature(difficulty);

        const response = await this.openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: prompt
                },
                {
                    role: "user",
                    content: `Current board state: ${boardState}\nValid moves: ${JSON.stringify(validMoves)}`
                }
            ],
            temperature: temperature,
            max_tokens: 10
        });

        const moveIndex = parseInt(response.choices[0].message.content || "0");
        return validMoves[moveIndex] || validMoves[0];
    }

    private async getGeminiMove(boardState: string, validMoves: Move[], difficulty: 'easy' | 'medium' | 'hard'): Promise<Move> {
        if (!this.genAI) {
            throw new Error('Gemini not configured');
        }

        const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = this.getDifficultyPrompt(difficulty);

        const result = await model.generateContent([
            prompt,
            `Current board state: ${boardState}\nValid moves: ${JSON.stringify(validMoves)}\nRespond only with a number representing the index of the chosen move.`
        ]);

        const response = await result.response;
        const text = response.text();
        const moveIndex = parseInt(text) || 0;
        
        return validMoves[moveIndex] || validMoves[0];
    }

    private getDifficultyPrompt(difficulty: 'easy' | 'medium' | 'hard'): string {
        switch (difficulty) {
            case 'easy':
                return "You are a beginner chess AI. Choose moves that are valid but don't focus too much on strategy. Respond only with the move index from the valid moves array.";
            case 'medium':
                return "You are an intermediate chess AI. Choose moves that show basic strategy and tactics. Respond only with the move index from the valid moves array.";
            case 'hard':
                return "You are an advanced chess AI. Choose the most strategic and tactical moves possible. Consider position, piece value, and control of the board. Respond only with the move index from the valid moves array.";
            default:
                return "You are a chess AI. Given the current board state and valid moves, select a move. Respond only with the move index from the valid moves array.";
        }
    }

    private getDifficultyTemperature(difficulty: 'easy' | 'medium' | 'hard'): number {
        switch (difficulty) {
            case 'easy':
                return 0.9;
            case 'medium':
                return 0.7;
            case 'hard':
                return 0.3;
            default:
                return 0.7;
        }
    }
}
