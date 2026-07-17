import messageService from '../services/messageService.js';
import onlineTracker from './onlineTracker.js';

// Regular expression to validate room, session, and moniker formatting
const ROOM_NAME_REGEX = /^[a-zA-Z0-9\-_]+$/;
const SESSION_ID_REGEX = /^[a-zA-Z0-9\-_]+$/;
const MONIKER_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

/**
 * Standard utility to emit structured socket errors to the client.
 */
const emitSocketError = (socket, message, code = 'BAD_REQUEST') => {
  socket.emit('error', {
    success: false,
    error: code,
    message: message
  });
};

/**
 * Broadcasts online counts to specific room and globally.
 * Passes the 'io' instance to leverage native clustering metrics.
 */
const broadcastOnlineCounts = (io, room) => {
  const roomCount = onlineTracker.getRoomCount(room, io);
  const globalCount = onlineTracker.getGlobalCount(io);

  // Emit room-specific count to all clients in the room
  io.to(room).emit('room_count_update', { room, count: roomCount });
  // Emit global count to all connected clients
  io.emit('global_count_update', { count: globalCount });
};

export const handleConnection = (io, socket) => {
  console.log(`[Socket] Client connected: ${socket.id} (IP: ${socket.handshake.address})`);

  // Track the current room of this socket
  let currentRoom = null;

  // -------------------------------------------------------------
  // SPAM & FLOOD PROTECTION (Socket Level Rate Limiter)
  // -------------------------------------------------------------
  const messageTimestamps = [];
  const MAX_MESSAGES_IN_WINDOW = 5;
  const WINDOW_MS = 5000; // 5 seconds window
  let muteUntil = 0;

  // 1. JOIN ROOM handler
  socket.on('join', async (data) => {
    try {
      const joinStart = performance.now();
      if (!data || typeof data !== 'object') {
        return emitSocketError(socket, 'Invalid payload structure', 'INVALID_PAYLOAD');
      }

      const { room, senderSessionId, moniker } = data;

      // Validate room name
      if (typeof room !== 'string') {
        return emitSocketError(socket, 'Room name must be a string', 'INVALID_ROOM_TYPE');
      }
      const targetRoom = room.trim();
      if (!targetRoom || !ROOM_NAME_REGEX.test(targetRoom) || targetRoom.length > 100) {
        return emitSocketError(socket, 'Invalid room name format', 'INVALID_ROOM_NAME');
      }

      // Validate session ID
      if (typeof senderSessionId !== 'string' || !SESSION_ID_REGEX.test(senderSessionId.trim())) {
        return emitSocketError(socket, 'Invalid sender session ID', 'INVALID_SESSION_ID');
      }

      // Validate moniker
      if (typeof moniker !== 'string' || !MONIKER_REGEX.test(moniker.trim())) {
        return emitSocketError(socket, 'Invalid moniker format', 'INVALID_MONIKER');
      }

      // If the socket was in another room, leave it
      if (currentRoom && currentRoom !== targetRoom) {
        socket.leave(currentRoom);
        const previousRoom = onlineTracker.trackLeave(socket.id);
        if (previousRoom) {
          broadcastOnlineCounts(io, previousRoom);
        }
      }

      // Join the new socket room
      socket.join(targetRoom);
      currentRoom = targetRoom;

      // Track online count
      onlineTracker.trackJoin(socket.id, targetRoom);

      // Load history using the optimized service layer (with lean queries)
      const history = await messageService.getRecentMessages(targetRoom, 100);

      // Emit history ONLY to the joining socket client
      socket.emit('history', {
        room: targetRoom,
        messages: history
      });

      // Broadcast counts to update all clients
      broadcastOnlineCounts(io, targetRoom);
      
      const duration = (performance.now() - joinStart).toFixed(2);
      console.log(`[Socket Metrics] Client ${socket.id} joined room: ${targetRoom} (Processing: ${duration}ms)`);

    } catch (err) {
      console.error(`[Socket.on('join')] Error:`, err);
      emitSocketError(socket, 'Failed to join room', 'SERVER_ERROR');
    }
  });

  // 2. MESSAGE EVENT handler (with strict rate-limiting and db audit logs)
  socket.on('message', async (data) => {
    try {
      const now = Date.now();

      // Check if the user is temporarily muted for spamming
      if (now < muteUntil) {
        const secondsLeft = Math.ceil((muteUntil - now) / 1000);
        return emitSocketError(socket, `Rate limit exceeded. Muted for ${secondsLeft}s. Please wait.`, 'RATE_LIMIT_EXCEEDED');
      }

      // Filter out timestamps older than our rate-limiting window
      while (messageTimestamps.length > 0 && now - messageTimestamps[0] > WINDOW_MS) {
        messageTimestamps.shift();
      }

      messageTimestamps.push(now);

      // Block client if they exceed threshold
      if (messageTimestamps.length > MAX_MESSAGES_IN_WINDOW) {
        muteUntil = now + 10000; // Mute for 10 seconds
        console.warn(`[Socket Security] Client ${socket.id} muted for sending messages too fast.`);
        return emitSocketError(socket, 'Too many messages. You are temporarily muted for 10s.', 'RATE_LIMIT_EXCEEDED');
      }

      if (!data || typeof data !== 'object') {
        return emitSocketError(socket, 'Invalid payload structure', 'INVALID_PAYLOAD');
      }

      const { content, senderSessionId, moniker, room } = data;

      // Double-check room context
      const targetRoom = room || currentRoom;
      if (!targetRoom) {
        return emitSocketError(socket, 'No active room context found. Please join a room first.', 'NO_ROOM_CONTEXT');
      }

      // Track performance metrics for database operation
      const dbStart = performance.now();

      // Delegate database operations and validations directly to messageService
      const savedMessage = await messageService.saveMessage({
        content,
        senderSessionId,
        moniker,
        room: targetRoom
      });

      const dbDuration = (performance.now() - dbStart).toFixed(2);
      console.log(`[Socket Metrics] Message persisted to MongoDB in ${dbDuration}ms`);

      // Broadcast the saved message document to everyone in the room (including sender)
      io.to(targetRoom).emit('message', savedMessage);

    } catch (err) {
      console.error(`[Socket.on('message')] Error:`, err);
      // Capture custom MessageServiceError details
      const msg = err.message || 'Failed to save and broadcast message';
      const code = err.errorCode || 'SERVER_ERROR';
      emitSocketError(socket, msg, code);
    }
  });

  // 3. TYPING STATUS handlers (with built-in flood-prevention debounce)
  let lastTypingStartTimestamp = 0;
  socket.on('typing:start', (data) => {
    if (!currentRoom || !data || typeof data.moniker !== 'string') return;
    
    const now = Date.now();
    // Debounce state broadcasts (limit to once every 2 seconds per client)
    if (now - lastTypingStartTimestamp < 2000) {
      return; 
    }
    lastTypingStartTimestamp = now;

    // Broadcast typing to everyone in the room except the typing client
    socket.to(currentRoom).emit('typing:start', {
      moniker: data.moniker.trim(),
      room: currentRoom
    });
  });

  socket.on('typing:stop', () => {
    if (!currentRoom) return;
    // Broadcast typing stop to everyone in the room except the client
    socket.to(currentRoom).emit('typing:stop', { room: currentRoom });
  });

  // 4. DISCONNECT / LEAVE handlers
  const handleLeaveCleanup = () => {
    if (currentRoom) {
      const leftRoom = onlineTracker.trackLeave(socket.id);
      if (leftRoom) {
        broadcastOnlineCounts(io, leftRoom);
        console.log(`[Socket] Client ${socket.id} cleaned up from room: ${leftRoom}`);
      }
      currentRoom = null;
    }
  };

  socket.on('leave', () => {
    if (currentRoom) {
      socket.leave(currentRoom);
      handleLeaveCleanup();
    }
  });

  socket.on('disconnecting', () => {
    handleLeaveCleanup();
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Client disconnected: ${socket.id} (Reason: ${reason})`);
  });
};

