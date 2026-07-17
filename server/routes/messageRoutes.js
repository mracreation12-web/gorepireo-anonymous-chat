import express from 'express';
import messageController from '../controllers/messageController.js';
import { validateMessageInput } from '../middleware/validateMessage.js';

const router = express.Router();

// -------------------------------------------------------------
// SELF-CONTAINED SECURITY & VALIDATION MIDDLEWARES
// -------------------------------------------------------------

// Simple, robust in-memory store for route-level spam rate limiting
const postLimits = new Map();
const LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_POST_REQUESTS = 30;     // Limit to 30 message posts per minute

/**
 * Route rate limiter to prevent flooding of new message posts.
 */
const postRateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (!postLimits.has(ip)) {
    postLimits.set(ip, []);
  }

  // Filter timestamps within the current active time window
  const requestTimestamps = postLimits.get(ip).filter(timestamp => now - timestamp < LIMIT_WINDOW_MS);
  requestTimestamps.push(now);
  postLimits.set(ip, requestTimestamps);

  if (requestTimestamps.length > MAX_POST_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Spam protection triggered. Please wait a minute before sending another message.'
    });
  }

  next();
};

/**
 * Validates and sanitizes historical message GET queries.
 */
const validateGetMessagesQuery = (req, res, next) => {
  const { limit, room } = req.query;

  // Validate the 'limit' query parameter if provided
  if (limit !== undefined) {
    const parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Query parameter "limit" must be a positive integer.'
      });
    }
  }

  // Validate the 'room' query parameter to prevent object-injection or format errors
  if (room !== undefined) {
    if (typeof room !== 'string' || room.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Query parameter "room" must be a valid non-empty string.'
      });
    }

    const roomNamePattern = /^[a-zA-Z0-9\-_]+$/;
    if (!roomNamePattern.test(room.trim())) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Query parameter "room" must only contain alphanumeric characters, hyphens, or underscores.'
      });
    }
  }

  next();
};

// -------------------------------------------------------------
// ENDPOINTS REGISTRATION
// -------------------------------------------------------------

// GET /api/messages - Retrieves messages for a room with sanity checks on filters
router.get('/', validateGetMessagesQuery, messageController.getMessages);

// POST /api/messages - Saves a new message protected by rate limiter and payload validation
router.post('/', postRateLimiter, validateMessageInput, messageController.createMessage);

export default router;

