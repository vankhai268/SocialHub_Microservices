import express from 'express';
import { protectRoute } from '../middlewares/auth.middleware.js';
import { httpClientService } from '../services/http-client.service.js';

const router = express.Router();

// --- user-service public routes ---
router.post('/auth/register', (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.post('/auth/login', (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.post('/auth/refresh', (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));

// --- user-service protected routes ---
router.post('/auth/logout', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.get('/users/search', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.get('/users/:id', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));
router.put('/users/:id', protectRoute, (req, res) => httpClientService.forwardToUserService(req, res, req.originalUrl));

// --- media-service routes (Map /api/media/... -> /media/...) ---
const mapToMediaService = (req, res) => {
  // Strip '/api' from originalUrl to match media-service routes
  // e.g. '/api/media/upload' -> '/media/upload'
  const targetPath = req.originalUrl.replace(/^\/api/, '');
  return httpClientService.forwardToMediaService(req, res, targetPath);
};

// All media routes are protected at Gateway level as per OpenAPI security schemes
router.post('/media/upload', protectRoute, mapToMediaService);
router.post('/media/batch-urls', protectRoute, mapToMediaService);
router.get('/media/:id', protectRoute, mapToMediaService);
router.get('/media/:id/url', protectRoute, mapToMediaService);
router.delete('/media/:id', protectRoute, mapToMediaService);

export default router;
