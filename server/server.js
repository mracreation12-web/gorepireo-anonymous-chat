import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './db.js';
import messageRoutes from './routes/messageRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import initSocket from './socket/index.js';

// 1. Load environment variables
dotenv.config();
// 2. Connect to MongoDB Atlas
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

// 3. Configure global middlewares
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// 4. API Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date(),
  });
});

// Bind Clean Architecture routing for message endpoints
app.use('/api/messages', messageRoutes);

// 5. Global Fallback Error Handler (Must be registered last)
app.use(errorHandler);

// 6. Start listener
const server = app.listen(PORT, () => {
  console.log(`[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Initialize real-time Socket.IO communication layer attached to server
initSocket(server);

export default server;

