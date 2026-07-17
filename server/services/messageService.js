import Message from '../models/Message.js';

/**
 * Custom application error class for message service errors.
 */
class MessageServiceError extends Error {
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVICE_ERROR') {
    super(message);
    this.name = 'MessageServiceError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Service to handle message database operations with production-grade security,
 * input validation, error handling, and performance optimizations.
 */
class MessageService {
  /**
   * Room name validation pattern: alphanumeric characters, hyphens, and underscores.
   */
  #ROOM_NAME_REGEX = /^[a-zA-Z0-9\-_]+$/;

  /**
   * Session ID validation pattern: alphanumeric characters, hyphens, and underscores.
   */
  #SESSION_ID_REGEX = /^[a-zA-Z0-9\-_]+$/;

  /**
   * Moniker validation pattern: alphanumeric characters, spaces, hyphens, and underscores.
   */
  #MONIKER_REGEX = /^[a-zA-Z0-9\s\-_]+$/;

  /**
   * Fetches the latest messages for a specific room.
   * Uses .lean() for optimal query performance and memory footprint.
   *
   * @param {string} room - Chat room name (validated).
   * @param {number} limit - Maximum number of messages to return (validated and bounded).
   * @returns {Promise<Array>} Chronologically sorted array of plain message objects.
   */
  async getRecentMessages(room = 'general', limit = 100) {
    // 1. Inputs validation and sanitization (prevents NoSQL injection and parameter abuse)
    if (typeof room !== 'string') {
      throw new MessageServiceError('Room name must be a valid string', 400, 'INVALID_ROOM_TYPE');
    }

    const sanitizedRoom = room.trim();
    if (!sanitizedRoom || !this.#ROOM_NAME_REGEX.test(sanitizedRoom)) {
      throw new MessageServiceError('Room name must only contain alphanumeric characters, hyphens, or underscores', 400, 'INVALID_ROOM_NAME');
    }

    if (sanitizedRoom.length > 100) {
      throw new MessageServiceError('Room name cannot exceed 100 characters', 400, 'ROOM_NAME_TOO_LONG');
    }

    // Parse, clamp, and bound the limit parameter to prevent DoS query abuse
    let parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      parsedLimit = 100;
    } else {
      // Enforce an upper bound of 100 to protect system memory
      parsedLimit = Math.min(parsedLimit, 100);
    }

    try {
      // 2. Fetch latest messages from the DB (newest first, lightweight lean query)
      const messages = await Message.find({ room: sanitizedRoom })
        .sort({ createdAt: -1 })
        .limit(parsedLimit)
        .lean()
        .exec();

      // 3. Map Mongoose Virtual id to ensure backward compatibility and reverse array (oldest to newest)
      return messages.map(msg => ({
        ...msg,
        id: msg._id ? msg._id.toString() : undefined
      })).reverse();

    } catch (error) {
      console.error(`[MessageService.getRecentMessages] Database query failed:`, error);
      throw new MessageServiceError('Failed to fetch recent messages. Please try again later.', 500, 'DATABASE_QUERY_ERROR');
    }
  }

  /**
   * Saves a new message to the database.
   *
   * @param {Object} messageData - Content, senderSessionId, moniker, and room.
   * @returns {Promise<Object>} The saved Message document instance.
   */
  async saveMessage(messageData) {
    if (!messageData || typeof messageData !== 'object') {
      throw new MessageServiceError('Invalid payload structure', 400, 'INVALID_PAYLOAD');
    }

    const { content, senderSessionId, moniker, room } = messageData;

    // 1. Content validation
    if (typeof content !== 'string') {
      throw new MessageServiceError('Message content must be a valid string', 400, 'INVALID_CONTENT_TYPE');
    }
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      throw new MessageServiceError('Message content cannot be empty', 400, 'EMPTY_CONTENT');
    }
    if (trimmedContent.length > 1000) {
      throw new MessageServiceError('Message content cannot exceed 1000 characters', 400, 'CONTENT_TOO_LONG');
    }

    // 2. Sender Session ID validation
    if (typeof senderSessionId !== 'string') {
      throw new MessageServiceError('Sender session ID must be a valid string', 400, 'INVALID_SESSION_TYPE');
    }
    const trimmedSessionId = senderSessionId.trim();
    if (trimmedSessionId.length < 10 || trimmedSessionId.length > 100 || !this.#SESSION_ID_REGEX.test(trimmedSessionId)) {
      throw new MessageServiceError('Sender session ID must be alphanumeric and between 10-100 characters', 400, 'INVALID_SESSION_ID');
    }

    // 3. Moniker validation
    if (typeof moniker !== 'string') {
      throw new MessageServiceError('Moniker must be a valid string', 400, 'INVALID_MONIKER_TYPE');
    }
    const trimmedMoniker = moniker.trim();
    if (trimmedMoniker.length < 2 || trimmedMoniker.length > 50 || !this.#MONIKER_REGEX.test(trimmedMoniker)) {
      throw new MessageServiceError('Moniker must be alphanumeric and between 2-50 characters', 400, 'INVALID_MONIKER');
    }

    // 4. Room validation
    const targetRoom = (room || 'general').trim();
    if (targetRoom.length === 0 || targetRoom.length > 100 || !this.#ROOM_NAME_REGEX.test(targetRoom)) {
      throw new MessageServiceError('Invalid room name parameter', 400, 'INVALID_ROOM_NAME');
    }

    try {
      // 5. Instantiate and save Mongoose model
      const newMessage = new Message({
        content: trimmedContent,
        senderSessionId: trimmedSessionId,
        moniker: trimmedMoniker,
        room: targetRoom,
      });

      const savedDoc = await newMessage.save();
      return savedDoc;

    } catch (error) {
      console.error(`[MessageService.saveMessage] Database save operation failed:`, error);
      
      // If validation error propagates from schema validation
      if (error.name === 'ValidationError') {
        const errorMsg = Object.values(error.errors).map(e => e.message).join(', ');
        throw new MessageServiceError(`Validation failed: ${errorMsg}`, 400, 'VALIDATION_ERROR');
      }

      throw new MessageServiceError('Failed to save the message. Please try again later.', 500, 'DATABASE_SAVE_ERROR');
    }
  }
}

export default new MessageService();

