import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';
import GroupChat from '../models/group.model.js';
import { fetchUsersBatch } from '../utils/api.js';
import { redisClient } from '../config/redis.js';
import { BadRequestError, NotFoundError } from '../utils/error.js';

/**
 * List conversations of a user (paginated)
 * @param {string} userId 
 * @param {number} page 
 * @param {number} limit 
 * @returns {Promise<Object>}
 */
export const listConversations = async (userId, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  // Get total conversations matching this user
  const total = await Conversation.countDocuments({ 'participants.userId': userId });
  
  // Find conversations, sorted by last active (updatedAt)
  const conversations = await Conversation.find({ 'participants.userId': userId })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('groupRef');

  // Collect all unique participant user IDs across all conversations for batch loading
  const allUserIds = new Set();
  conversations.forEach(conv => {
    conv.participants.forEach(p => allUserIds.add(p.userId));
  });

  // Batch query display details from user-service
  const users = await fetchUsersBatch(Array.from(allUserIds));
  const userMap = new Map(users.map(u => [u.id, u]));

  // Enrich conversations with dynamic presence & unread counts
  const data = await Promise.all(conversations.map(async (conv) => {
    const resolvedParticipants = await Promise.all(conv.participants.map(async (p) => {
      const u = userMap.get(p.userId) || { displayName: 'User', avatarUrl: null };
      const isOnline = !!(await redisClient.get(`online:${p.userId}`));
      return {
        userId: p.userId,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        isOnline
      };
    }));

    // Find messages in this conversation not read by the user
    const unreadCount = await Message.countDocuments({
      conversationId: conv._id,
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId }
    });

    const convJson = conv.toJSON();
    convJson.participants = resolvedParticipants;
    convJson.unreadCount = unreadCount;

    // Map group specific name and avatar if type is group
    if (conv.type === 'group' && conv.groupRef) {
      convJson.name = conv.groupRef.name;
      convJson.avatarUrl = conv.groupRef.avatarUrl;
    }

    return convJson;
  }));

  return {
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Create or retrieve a 1-1 conversation
 * @param {string} userId 
 * @param {string} participantId 
 * @returns {Promise<Object>}
 */
export const createConversation = async (userId, participantId) => {
  if (userId === participantId) {
    throw new BadRequestError('Cannot create conversation with self');
  }

  // Find existing 1-1 conversation
  let conversation = await Conversation.findOne({
    type: 'direct',
    'participants.userId': { $all: [userId, participantId] },
    participants: { $size: 2 }
  });

  let statusCode = 200;

  if (!conversation) {
    statusCode = 201;
    conversation = await Conversation.create({
      type: 'direct',
      participants: [
        { userId: userId },
        { userId: participantId }
      ]
    });
  }

  // Fetch participant info for return format
  const users = await fetchUsersBatch([userId, participantId]);
  const userMap = new Map(users.map(u => [u.id, u]));

  const resolvedParticipants = await Promise.all(conversation.participants.map(async (p) => {
    const u = userMap.get(p.userId) || { displayName: 'User', avatarUrl: null };
    const isOnline = !!(await redisClient.get(`online:${p.userId}`));
    return {
      userId: p.userId,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      isOnline
    };
  }));

  const convJson = conversation.toJSON();
  convJson.participants = resolvedParticipants;
  convJson.unreadCount = 0;

  return { conversation: convJson, statusCode };
};
