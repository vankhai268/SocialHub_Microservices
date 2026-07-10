import Redis from 'ioredis';
import config from './index.js';

const redisUrl = config.REDIS_URL;

// Main Redis client for presence / caching
export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Redis client for publishing events (Pub/Sub)
export const redisPublisher = new Redis(redisUrl);

redisClient.on('connect', () => {
  console.log('⚡ Connected to Redis for Presence/Caching (chat-service)');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Presence/Cache Error:', err.message);
});

redisPublisher.on('connect', () => {
  console.log('📢 Connected to Redis for Pub/Sub Publisher (chat-service)');
});

redisPublisher.on('error', (err) => {
  console.error('❌ Redis Publisher Error:', err.message);
});

export default {
  redisClient,
  redisPublisher
};
