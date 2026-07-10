import { redisClient } from '../config/redis.js';
import Conversation from '../models/conversation.model.js';

/**
 * Handle actions when user connects and comes online
 */
export const handleUserOnline = async (io, socket) => {
  const { userId } = socket;

  // Set presence key in Redis (TTL 5 minutes)
  await redisClient.setex(`online:${userId}`, 300, 'true');

  // Find all conversations containing this user
  const conversations = await Conversation.find({ 'participants.userId': userId });

  // Join the user socket to all conversation rooms and notify others
  conversations.forEach(conv => {
    const roomId = `conv:${conv._id.toString()}`;
    socket.join(roomId);
    
    // Broadcast user:online to the room (excluding sender)
    socket.to(roomId).emit('user:online', { userId });
  });

  // Join a personal room for single-recipient targeting (like new conversation invites)
  socket.join(`user:${userId}`);
  console.log(`🟢 User ${userId} (${socket.displayName}) is online`);
};

/**
 * Handle actions when user disconnects and goes offline
 */
export const handleUserOffline = async (io, socket) => {
  const { userId } = socket;

  // Remove presence key from Redis
  await redisClient.del(`online:${userId}`);

  // Broadcast user:offline to all conversations
  const conversations = await Conversation.find({ 'participants.userId': userId });
  conversations.forEach(conv => {
    const roomId = `conv:${conv._id.toString()}`;
    socket.to(roomId).emit('user:offline', { userId });
  });
  
  console.log(`🔴 User ${userId} (${socket.displayName}) went offline`);
};

/**
 * Register presence heartbeat listener
 */
export default (io, socket) => {
  socket.on('presence:heartbeat', async () => {
    // Extend presence key TTL in Redis
    await redisClient.setex(`online:${socket.userId}`, 300, 'true');
  });
};
