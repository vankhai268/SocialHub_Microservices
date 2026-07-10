import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { load } from 'js-yaml';
import fs from 'fs';
import path from 'path';

const router = express.Router();

const loadSpec = (filename) => {
  try {
    const filePath = path.resolve(process.cwd(), `../docs/api-specs/${filename}`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return load(fileContent);
  } catch (err) {
    console.error(`[ERROR] Failed to load OpenAPI spec ${filename}:`, err.message);
    return null;
  }
};

const userSpec = loadSpec('user-service.yaml');
const friendSpec = loadSpec('friend-service.yaml');
const postSpec = loadSpec('post-service.yaml');
const mediaSpec = loadSpec('media-service.yaml');
const notificationSpec = loadSpec('notification-service.yaml');
const chatSpec = loadSpec('chat-service.yaml');

// Endpoints to serve individual JSON specs for the Swagger UI explorer dropdown
router.get('/specs/user', (req, res) => res.json(userSpec));
router.get('/specs/friend', (req, res) => res.json(friendSpec));
router.get('/specs/post', (req, res) => res.json(postSpec));
router.get('/specs/media', (req, res) => res.json(mediaSpec));
router.get('/specs/notification', (req, res) => res.json(notificationSpec));
router.get('/specs/chat', (req, res) => res.json(chatSpec));

const swaggerOptions = {
  explorer: true,
  swaggerOptions: {
    urls: [
      { url: '/api-docs/specs/user', name: 'User & Auth Service' },
      { url: '/api-docs/specs/friend', name: 'Friend Service' },
      { url: '/api-docs/specs/post', name: 'Post Service' },
      { url: '/api-docs/specs/media', name: 'Media Service' },
      { url: '/api-docs/specs/notification', name: 'Notification Service' },
      { url: '/api-docs/specs/chat', name: 'Chat Service' }
    ]
  }
};

router.use('/', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions));

export default router;
