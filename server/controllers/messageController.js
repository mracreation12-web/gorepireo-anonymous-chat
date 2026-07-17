import messageService from '../services/messageService.js';

/**
 * Controller to handle REST HTTP requests for Messages.
 */
class MessageController {
  /**
   * GET /api/messages
   * Returns latest 100 messages sorted ascending by createdAt.
   */
  getMessages = async (req, res, next) => {
    try {
      const room = req.query.room || 'general';
      const limit = parseInt(req.query.limit, 10) || 100;

      const messages = await messageService.getRecentMessages(room, limit);

      res.status(200).json({
        success: true,
        count: messages.length,
        data: messages,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/messages
   * Saves a new message. Validation is pre-handled by middleware.
   */
  createMessage = async (req, res, next) => {
    try {
      const { content, senderSessionId, moniker, room } = req.body;

      const savedMessage = await messageService.saveMessage({
        content,
        senderSessionId,
        moniker,
        room,
      });

      res.status(201).json({
        success: true,
        data: savedMessage,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new MessageController();
