import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const protectRoute = (req, res, next) => {
  try {
    // 1. Trust API Gateway validation if x-user-id header is present (Optimization)
    const gatewayUserId = req.headers['x-user-id'];
    if (gatewayUserId) {
      req.user = { id: gatewayUserId };
      return next();
    }

    // 2. Standalone execution: decode and verify JWT token locally
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, token missing' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded; // For metadata tracking

    next();
  } catch (error) {
    console.error('❌ Media Service Auth Error:', error.message);
    return res.status(401).json({ error: 'Not authorized, invalid token' });
  }
};
