import dotenv from 'dotenv';
// Load environment variables before other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import aiRoutes from './routes/aiRoutes';
import cryptoRoutes from './routes/cryptoRoutes';
import { GameServer } from './services/GameServer';

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize WebSocket server
new GameServer(server);

// Configure CORS to allow connections from any origin
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use('/api/ai', aiRoutes);
app.use('/api/crypto', cryptoRoutes);

app.get('/', (req, res) => {
  res.send('Chess server running!');
});

// Listen on all network interfaces (0.0.0.0) to allow external connections
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} on all interfaces (0.0.0.0)`);
  console.log(`WebSocket server available at ws://your-ip-address:${PORT}/ws/game/ROOMID`);
});
