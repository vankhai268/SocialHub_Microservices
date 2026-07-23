import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';
import { fetchMediaUrl } from '../utils/api.js';
import { ForbiddenError, NotFoundError } from '../utils/error.js';

/**
 * Get message history for a conversation (cursor-based pagination)
 * @param {string} userId - ID of user making request
 * @param {string} conversationId - Conversation to load messages from
 * @param {string|null} before - Cursor message ID
 * @param {number} limit 
 * @param {string} token - User's authorization token for media-service URL resolution
 * @returns {Promise<Object>}
 */
export const getMessages = async (userId, conversationId, before = null, limit = 50, token) => {
  // Validate conversation exists
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw new NotFoundError('Conversation not found');
  }

  // Verify membership
  const isParticipant = conversation.participants.some(p => p.userId === userId);
  if (!isParticipant) {
    throw new ForbiddenError('Not a participant of this conversation');
  }

  const query = { conversationId };

  if (before) {
    const beforeMessage = await Message.findById(before);
    if (beforeMessage) {
      query.createdAt = { $lt: beforeMessage.createdAt };
    }
  }

  const maxLimit = Math.min(limit, 100);

  // Fetch limit + 1 to find out if hasMore is true
  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(maxLimit + 1);

  const hasMore = messages.length > maxLimit;
  if (hasMore) {
    messages.pop(); // Remove extra item
  }

  // Populate presigned URLs for image type messages on the fly
  const resolvedMessages = await Promise.all(messages.map(async (msg) => {
    const msgJson = msg.toJSON();
    if ((msgJson.type === 'image' || msgJson.type === 'audio') && msgJson.mediaId) {
      const mediaUrl = await fetchMediaUrl(msgJson.mediaId, token);
      msgJson.mediaUrl = mediaUrl;
    }
    return msgJson;
  }));

  const nextCursor = hasMore && resolvedMessages.length > 0
    ? resolvedMessages[resolvedMessages.length - 1].id
    : null;

  return {
    data: resolvedMessages,
    hasMore,
    nextCursor
  };
};
