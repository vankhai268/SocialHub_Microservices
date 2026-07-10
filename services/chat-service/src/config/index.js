import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (useful for local development outside docker)
dotenv.config();

export const config = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/socialhub_chat',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://user-service:5000',
  MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL || 'http://media-service:5000'
};

export default config;
