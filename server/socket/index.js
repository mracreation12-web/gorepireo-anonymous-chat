import { Server } from 'socket.io';
import { handleConnection } from './eventHandlers.js';

/**
 * Initializes and configures the Socket.IO server.
 * Hooks it directly onto the existing Express HTTP listener.
 *
 * @param {import('http').Server} httpServer - The Node.js HTTP server instance.
 * @returns {Server} The configured Socket.IO server.
 */
const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    // Enterprise Configuration for production stability
    pingTimeout: 30000,     // Time client has to respond to a ping (30s)
    pingInterval: 15000,    // Time between sending pings to clients (15s)
    connectTimeout: 20000,  // Connection timeout limit (20s)
    transports: ['websocket', 'polling'], // Fallback transport compatibility
    maxHttpBufferSize: 1e6  // Payload limit: 1MB (protects against memory flooding)
  });

  console.log('[Socket] Socket.IO Server successfully initialized');

  // Handle client connections
  io.on('connection', (socket) => {
    handleConnection(io, socket);
  });

  // Graceful shutdown registration
  const shutdown = () => {
    console.log('[Socket] Initiating graceful shutdown of Socket.IO server...');
    io.close(() => {
      console.log('[Socket] Socket.IO server closed cleanly.');
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return io;
};

export default initSocket;

