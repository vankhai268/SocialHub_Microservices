import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import gatewayRoutes from './routes/gateway.routes.js';
import { rateLimiter } from './middlewares/rate-limiter.middleware.js';

const app = express();

// Base Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// Health check endpoint for Gateway
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'gateway',
    timestamp: new Date().toISOString()
  });
});

// Apply rate limiting & mount Gateway routes under /api
// Limit to 100 requests per minute per endpoint/IP
app.use('/api', rateLimiter(100, 60), gatewayRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found on Gateway`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global error in API Gateway:', err);
  
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred in the API Gateway'
  });
});

export default app;
