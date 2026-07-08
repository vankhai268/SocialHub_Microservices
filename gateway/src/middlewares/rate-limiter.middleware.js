import redis from '../config/redis.js';

/**
 * Custom rate limiter using Redis
 * @param {number} limit number of requests allowed per window (default: 60)
 * @param {number} windowSeconds window size in seconds (default: 60)
 */
export const rateLimiter = (limit = 60, windowSeconds = 60) => {
  return async (req, res, next) => {
    try {
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      const endpoint = req.path;
      const key = `ratelimit:${ip}:${endpoint}`;

      // Increment request count for this IP + Endpoint
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, limit - current);
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', remaining);

      if (current > limit) {
        const ttl = await redis.ttl(key);
        res.setHeader('Retry-After', ttl > 0 ? ttl : windowSeconds);

        return res.status(429).json({
          success: false,
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.'
        });
      }

      next();
    } catch (error) {
      console.error('[ERROR] Error in Gateway Rate Limiter Middleware:', error.message);
      // Fail-safe: allow requests to pass through if Redis is having issues
      next();
    }
  };
};
