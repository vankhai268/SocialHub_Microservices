import app from './app.js';
import { config } from './config/index.js';
import redis from './config/redis.js';

const startServer = async () => {
  try {
    // 1. Verify Redis connection is ready
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    
    // 2. Start Express server
    const server = app.listen(config.PORT, () => {
      console.log(`🚀 API Gateway running in ${config.ENVIRONMENT} mode on port ${config.PORT}`);
      console.log(`🔗 Routing user-service requests to: ${config.USER_SERVICE_URL}`);
      console.log(`🔗 Routing media-service requests to: ${config.MEDIA_SERVICE_URL}`);
    });

    // Graceful Shutdown
    const shutdown = (signal) => {
      console.log(`\n📥 ${signal} received. Shutting down gracefully...`);
      
      server.close(async () => {
        console.log('🚪 HTTP server closed.');
        try {
          await redis.quit();
          console.log('🔌 Redis client disconnected.');
          process.exit(0);
        } catch (err) {
          console.error('❌ Error disconnecting Redis during shutdown:', err.message);
          process.exit(1);
        }
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('⚠️ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    console.error('❌ Failed to start API Gateway:', error);
    process.exit(1);
  }
};

startServer();
