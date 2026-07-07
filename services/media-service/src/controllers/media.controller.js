import { v4 as uuidv4 } from 'uuid';
import { minioService } from '../services/minio.service.js';
import { Media } from '../models/media.model.js';
import { config } from '../config/index.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/error.js';

export const mediaController = {
  uploadMedia: async (req, res, next) => {
    try {
      const file = req.file;
      const userId = req.headers['x-user-id']; 

      if (!file) throw new BadRequestError('No file uploaded');
      if (!userId) throw new ForbiddenError('Unauthorized: Missing x-user-id');

      // Kiểm tra size theo loại file
      const isVideo = req.fileCategory === 'video';
      const maxSize = isVideo ? config.MAX_VIDEO_SIZE : config.MAX_FILE_SIZE;
      if (file.size > maxSize) {
        const maxMB = maxSize / 1024 / 1024;
        throw new BadRequestError(`File too large. Max size for ${isVideo ? 'video' : 'image'}: ${maxMB}MB`);
      }
      // Tạo objectKey duy nhất để lưu trên MinIO (VD: user-123/abcd.jpg)
      const ext = file.originalname.split('.').pop();
      const objectKey = `${userId}/${uuidv4()}.${ext}`;

      // 1. Ném file sang MinIO
      await minioService.uploadFile(objectKey, file.buffer, file.mimetype, file.size);

      // 2. Lưu Metadata vào MongoDB
      const media = await Media.create({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        objectKey: objectKey,
        uploadedBy: userId,
      });

      // 3. Trả về cho client (không trả objectKey để bảo mật)
      res.status(201).json({
        id: media._id,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: media.size,
        uploadedBy: media.uploadedBy,
        createdAt: media.createdAt
      });
    } catch (err) {
      next(err);
    }
  },

  getMediaMetadata: async (req, res, next) => {
    try {
      const media = await Media.findById(req.params.id);
      if (!media) throw new NotFoundError('Media not found');
      
      res.json(media);
    } catch (err) {
      next(err);
    }
  },

  getPresignedUrl: async (req, res, next) => {
    try {
      const media = await Media.findById(req.params.id);
      if (!media) throw new NotFoundError('Media not found');

      // Tạo link tạm thời
      const url = await minioService.generatePresignedUrl(media.objectKey, config.PRESIGNED_URL_TTL);
      const expiresAt = new Date(Date.now() + config.PRESIGNED_URL_TTL * 1000);

      res.json({
        mediaId: media._id,
        url,
        expiresAt,
        ttlSeconds: config.PRESIGNED_URL_TTL
      });
    } catch (err) {
      next(err);
    }
  },

  deleteMedia: async (req, res, next) => {
    try {
      const userId = req.headers['x-user-id'];
      if (!userId) throw new ForbiddenError('Unauthorized');

      const media = await Media.findById(req.params.id);
      if (!media) throw new NotFoundError('Media not found');

      // Chỉ chủ nhân mới được xóa ảnh của mình
      if (media.uploadedBy !== userId) {
        throw new ForbiddenError('You can only delete your own media');
      }

      // Xóa ở MinIO trước
      await minioService.deleteFile(media.objectKey);
      // Xóa ở MongoDB
      await Media.findByIdAndDelete(media._id);

      res.json({ message: 'Media deleted successfully' });
    } catch (err) {
      next(err);
    }
  },

  getBatchUrls: async (req, res, next) => {
    try {
      const { mediaIds } = req.body;
      if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
        throw new BadRequestError('mediaIds must be a non-empty array');
      }

      const urls = [];
      for (const id of mediaIds) {
        try {
          const media = await Media.findById(id);
          if (media) {
            const url = await minioService.generatePresignedUrl(media.objectKey, config.PRESIGNED_URL_TTL);
            urls.push({ mediaId: id, url, expiresAt: new Date(Date.now() + config.PRESIGNED_URL_TTL * 1000) });
          }
        } catch(e) {
          // Bỏ qua lỗi với từng ID đơn lẻ (ảnh bị xóa, v.v.)
        }
      }
      res.json({ urls });
    } catch (err) {
      next(err);
    }
  },

  healthCheck: async (req, res, next) => {
    try {
      await minioService.checkHealth();
      res.json({ status: 'ok', service: 'media-service' });
    } catch (err) {
      res.status(503).json({ status: 'error', message: 'MinIO unreachable' });
    }
  }
};
