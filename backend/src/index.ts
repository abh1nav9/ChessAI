import dotenv from 'dotenv';
// Load environment variables before other imports
dotenv.config();

import express from 'express';
import cors from 'cors';
import aiRoutes from './routes/aiRoutes';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/ai', aiRoutes);

app.get('/', (req, res) => {
  res.send('Hello, TypeScript with Node.js!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
