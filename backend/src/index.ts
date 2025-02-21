import dotenv from 'dotenv';
// Load environment variables before other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import aiRoutes from './routes/aiRoutes';
import { GameServer } from './services/GameServer';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize WebSocket server
new GameServer(server);

app.use(cors());
app.use(express.json());

app.use('/api/ai', aiRoutes);

app.get('/', (req, res) => {
  res.send('Chess server running!');
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
