import mongoose from 'mongoose';

const GroupMemberSchema = new mongoose.Schema({
  userId: {
    type: String, // UUID
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String, // URL, nullable
    default: null
  },
  role: {
    type: String,
    enum: ['admin', 'member'],
    default: 'member'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const GroupChatSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String, // URL, nullable
    default: null
  },
  members: [GroupMemberSchema],
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  }
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

// Virtual property for memberCount to avoid storing redundant count field
GroupChatSchema.virtual('memberCount').get(function() {
  return this.members ? this.members.length : 0;
});

const GroupChat = mongoose.model('GroupChat', GroupChatSchema);
export default GroupChat;
