import Redis from 'ioredis';
import { config } from './index.js';

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3
});

redis.on('connect', () => {
  console.log('⚡ Redis connected successfully in API Gateway!');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error in API Gateway:', err.message);
});

export default redis;
