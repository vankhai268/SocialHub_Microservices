import mongoose from 'mongoose';

const ReadBySchema = new mongoose.Schema({
  userId: {
    type: String, // UUID
    required: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  senderId: {
    type: String, // UUID
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  senderAvatar: {
    type: String, // URL, nullable
    default: null
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'share', 'audio'],
    default: 'text'
  },
  mediaId: {
    type: String, // UUID from media-service
    default: null
  },
  mediaUrl: {
    type: String, // Presigned URL, nullable
    default: null
  },
  readBy: [ReadBySchema]
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Index for efficient cursor-based pagination
MessageSchema.index({ conversationId: 1, createdAt: -1 });

const Message = mongoose.model('Message', MessageSchema);
export default Message;
