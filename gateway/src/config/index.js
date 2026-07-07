import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export const config = {
  PORT: process.env.PORT || 8000,
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://user-service:5000',
  MEDIA_SERVICE_URL: process.env.MEDIA_SERVICE_URL || 'http://media-service:5000',
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  REDIS_URL: process.env.REDIS_URL || 'redis://redis:6379',
  
  // Circuit Breaker default options
  CIRCUIT_BREAKER_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT, 10) || 5000, // 5s
  CIRCUIT_BREAKER_ERROR_THRESHOLD: parseInt(process.env.CIRCUIT_BREAKER_ERROR_THRESHOLD, 10) || 50, // 50%
  CIRCUIT_BREAKER_RESET_TIMEOUT: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 10) || 10000 // 10s
};
