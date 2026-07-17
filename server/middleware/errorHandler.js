/**
 * Global error handling middleware for unified JSON responses.
 */
export const errorHandler = (err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      error: 'ValidationError',
      message: messages.join(', '),
    });
  }

  // CastError (e.g. invalid MongoDB ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'CastError',
      message: `Invalid format for field ${err.path}.`,
    });
  }

  // Fallback for general server errors
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: message,
    // Only return stack trace in development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};
