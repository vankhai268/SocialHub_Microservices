import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Main Redis client for caching
export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Redis client for publishing events
export const redisPublisher = new Redis(redisUrl);

redisClient.on('connect', () => {
  console.log('⚡ Connected to Redis for Caching');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Cache Error:', err);
});

redisPublisher.on('connect', () => {
  console.log('📢 Connected to Redis for Pub/Sub (Publisher)');
});

redisPublisher.on('error', (err) => {
  console.error('❌ Redis Publisher Error:', err);
});
