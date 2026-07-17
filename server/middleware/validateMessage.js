/**
 * Middleware to validate message input before saving to database.
 */
export const validateMessageInput = (req, res, next) => {
  const { content, senderSessionId, moniker, room } = req.body;

  // 1. Content validations
  if (!content) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Message content is required.',
    });
  }

  const trimmedContent = content.trim();

  if (trimmedContent.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Message content cannot be empty or contain only whitespace.',
    });
  }

  if (trimmedContent.length > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Message content cannot exceed 1000 characters.',
    });
  }

  // 2. Sender details validation
  if (!senderSessionId || typeof senderSessionId !== 'string' || senderSessionId.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Valid sender session ID is required.',
    });
  }

  if (!moniker || typeof moniker !== 'string' || moniker.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Moniker is required.',
    });
  }

  // 3. Room name validation (optional, but keep it clean)
  if (room && (typeof room !== 'string' || room.trim() === '')) {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Room name must be a valid string.',
    });
  }

  // Pass sanitized inputs down the chain
  req.body.content = trimmedContent;
  req.body.senderSessionId = senderSessionId.trim();
  req.body.moniker = moniker.trim();
  if (room) req.body.room = room.trim();

  next();
};
