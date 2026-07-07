import express from 'express';
import { mediaController } from '../controllers/media.controller.js';
import { uploadSingle } from '../middlewares/upload.middleware.js';

const router = express.Router();

router.get('/health', mediaController.healthCheck);
router.post('/media/upload', uploadSingle, mediaController.uploadMedia);
router.post('/media/batch-urls', mediaController.getBatchUrls); // Phải nằm trước /:id
router.get('/media/:id', mediaController.getMediaMetadata);
router.get('/media/:id/url', mediaController.getPresignedUrl);
router.delete('/media/:id', mediaController.deleteMedia);

export default router;
