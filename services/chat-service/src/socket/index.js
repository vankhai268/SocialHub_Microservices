import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import config from '../config/index.js';
import { socketAuthMiddleware } from './auth.handler.js';
import registerMessageHandlers from './message.handler.js';
import registerTypingHandlers from './typing.handler.js';
import registerPresenceHandlers, { handleUserOnline, handleUserOffline } from './presence.handler.js';

let ioInstance = null;

/**
 * Initialize Socket.IO server and bind it to the HTTP server
 * @param {import('http').Server} server 
 * @returns {Server}
 */
export const initSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    // Required to receive authorization from gateway websocket proxy
    path: '/socket.io/'
  });

  // Setup Redis clients for the socket.io adapter (independent of main publisher)
  const pubClient = new Redis(config.REDIS_URL);
  const subClient = new Redis(config.REDIS_URL);

  pubClient.on('error', (err) => console.error('❌ Socket.IO Redis Pub Client Error:', err.message));
  subClient.on('error', (err) => console.error('❌ Socket.IO Redis Sub Client Error:', err.message));

  // Attach Redis adapter for horizontal scaling
  io.adapter(createAdapter(pubClient, subClient));

  // Apply authorization handshake middleware
  io.use(socketAuthMiddleware);

  io.on('connection', async (socket) => {
    try {
      // 1. Handle user coming online, join rooms, broadcast presence
      await handleUserOnline(io, socket);

      // 2. Register event handlers
      registerMessageHandlers(io, socket);
      registerTypingHandlers(io, socket);
      registerPresenceHandlers(io, socket);

      // 3. Handle user disconnection
      socket.on('disconnect', async () => {
        await handleUserOffline(io, socket);
      });
    } catch (err) {
      console.error(`❌ Socket Connection Setup Error for User ${socket.userId}:`, err.message);
      socket.disconnect(true);
    }
  });

  ioInstance = io;
  console.log('🔌 Socket.IO Server initialized with Redis Adapter');
  return io;
};

/**
 * Get active Socket.IO server instance
 * @returns {Server}
 */
export const getIoInstance = () => {
  if (!ioInstance) {
    throw new Error('Socket.IO instance has not been initialized');
  }
  return ioInstance;
};
