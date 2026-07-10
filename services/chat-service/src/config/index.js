import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (useful for local development outside docker)
dotenv.config();

export const config = {
  PORT: process.env.PORT || 5004,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://socialhub:socialhub_secret@localhost:27018/socialhub_chat?authSource=admin',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:5001',
  MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL || 'http://localhost:5005'
};

export default config;
