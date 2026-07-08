import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export const protectRoute = (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, token missing' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded; // Dành cho upload_media metadata tracking nếu cần

    next();
  } catch (error) {
    console.error('❌ Media Service Auth Error:', error.message);
    return res.status(401).json({ error: 'Not authorized, invalid token' });
  }
};
