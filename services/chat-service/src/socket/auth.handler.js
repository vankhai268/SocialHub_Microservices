import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { fetchUsersBatch } from '../utils/api.js';

/**
 * Socket.IO authentication middleware
 */
export const socketAuthMiddleware = async (socket, next) => {
  try {
    let token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    // Strip "Bearer " prefix if present
    if (token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    // Verify JWT
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const userId = decoded.id;

    // Fetch user details for realtime message sender meta info via public batch API
    const users = await fetchUsersBatch([userId]);
    const user = users && users[0];
    if (!user) {
      return next(new Error('Authentication error: User not found in system'));
    }

    // Inject credentials/profile metadata into the socket instance
    socket.userId = userId;
    socket.displayName = user.displayName || 'User';
    socket.avatarUrl = user.avatarUrl || null;
    socket.token = `Bearer ${token}`;

    next();
  } catch (error) {
    console.error('❌ Socket Authentication Error:', error.message);
    return next(new Error('Authentication error: Invalid or expired token'));
  }
};
