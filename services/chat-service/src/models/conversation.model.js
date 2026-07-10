import mongoose from 'mongoose';

const ParticipantSchema = new mongoose.Schema({
  userId: {
    type: String, // UUID from user-service
    required: true
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const LastMessageSchema = new mongoose.Schema({
  content: {
    type: String,
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
  createdAt: {
    type: Date,
    required: true
  }
}, { _id: false });

const ConversationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  participants: [ParticipantSchema],
  groupRef: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GroupChat',
    default: null
  },
  lastMessage: {
    type: LastMessageSchema,
    default: null
  }
}, {
  timestamps: true,
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

// Index for query efficiency on participants
ConversationSchema.index({ 'participants.userId': 1 });

const Conversation = mongoose.model('Conversation', ConversationSchema);
export default Conversation;
