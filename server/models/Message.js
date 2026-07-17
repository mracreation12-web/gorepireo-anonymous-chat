import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Message content is required'],
    trim: true,
    minlength: [1, 'Message content must be at least 1 character'],
    maxlength: [1000, 'Message content cannot exceed 1000 characters'],
    validate: {
      validator: function(v) {
        return v && v.trim().length > 0;
      },
      message: 'Message content cannot contain only whitespace'
    }
  },
  room: {
    type: String,
    default: 'general',
    trim: true,
    minlength: [1, 'Room name cannot be empty'],
    maxlength: [100, 'Room name cannot exceed 100 characters'],
    match: [/^[a-zA-Z0-9\-_]+$/, 'Room name must only contain alphanumeric characters, hyphens, or underscores']
  },
  senderSessionId: {
    type: String,
    required: [true, 'Sender session ID is required'],
    trim: true,
    minlength: [10, 'Sender session ID is too short'],
    maxlength: [100, 'Sender session ID cannot exceed 100 characters'],
    match: [/^[a-zA-Z0-9\-_]+$/, 'Sender session ID must only contain alphanumeric characters, hyphens, or underscores']
  },
  moniker: {
    type: String,
    required: [true, 'Moniker is required'],
    trim: true,
    minlength: [2, 'Moniker must be at least 2 characters long'],
    maxlength: [50, 'Moniker cannot exceed 50 characters'],
    match: [/^[a-zA-Z0-9\s\-_]+$/, 'Moniker must only contain alphanumeric characters, spaces, hyphens, or underscores']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true, // Prevent modifications to creation date
  },
}, {
  timestamps: false, // Handled manually and immutably via createdAt
  versionKey: false, // Disables __v field to optimize document size
  strict: true,      // Rejects fields not defined in the schema
  minimize: true,    // Removes empty objects from serialization
  toJSON: {
    virtuals: true,
  },
  toObject: {
    virtuals: true
  }
});

// Primary compound index for query performance (retrieving room history sorted by time)
messageSchema.index({ room: 1, createdAt: 1 });

// TTL Index: Automatically expires and deletes messages after 30 days (2,592,000 seconds)
// This preserves anonymity, keeps database size controlled, and maintains high performance.
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

const Message = mongoose.model('Message', messageSchema);

export default Message;

