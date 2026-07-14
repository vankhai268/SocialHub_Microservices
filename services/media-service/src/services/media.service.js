import { v4 as uuidv4 } from 'uuid';
import { minioService } from './minio.service.js';
import { Media } from '../models/media.model.js';
import { config } from '../config/index.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/error.js';

export const mediaService = {
  uploadMedia: async (file, userId, fileCategory) => {
    if (!file) throw new BadRequestError('No file uploaded');
    if (!userId) throw new ForbiddenError('Unauthorized: Missing x-user-id');

    const isVideo = fileCategory === 'video';
    const maxSize = isVideo ? config.MAX_VIDEO_SIZE : config.MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / 1024 / 1024;
      throw new BadRequestError(`File too large. Max size for ${isVideo ? 'video' : 'image'}: ${maxMB}MB`);
    }

    const ext = file.originalname.split('.').pop();
    const objectKey = `${userId}/${uuidv4()}.${ext}`;

    await minioService.uploadFile(objectKey, file.buffer, file.mimetype, file.size);

    const media = await Media.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      objectKey: objectKey,
      uploadedBy: userId,
    });

    return {
      id: media._id.toString(),
      originalName: media.originalName,
      mimeType: media.mimeType,
      size: media.size,
      uploadedBy: media.uploadedBy,
      createdAt: media.createdAt
    };
  },

  getMediaMetadata: async (id) => {
    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');
    return media;
  },

  getFileStream: async (id) => {
    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');

    const stream = await minioService.getFileStream(media.objectKey);
    return {
      stream,
      mimeType: media.mimeType,
      size: media.size
    };
  },

  getPresignedUrl: async (id) => {
    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');

    // Trả về relative URL để đi qua proxy API Gateway
    const url = `/media/file/${media._id}`;
    const expiresAt = new Date(Date.now() + config.PRESIGNED_URL_TTL * 1000);

    return {
      mediaId: media._id.toString(),
      url,
      expiresAt,
      ttlSeconds: config.PRESIGNED_URL_TTL
    };
  },

  deleteMedia: async (id, userId) => {
    if (!userId) throw new ForbiddenError('Unauthorized');

    const media = await Media.findById(id);
    if (!media) throw new NotFoundError('Media not found');

    if (media.uploadedBy !== userId) {
      throw new ForbiddenError('You can only delete your own media');
    }

    await minioService.deleteFile(media.objectKey);
    await Media.findByIdAndDelete(media._id);
  },

  getBatchUrls: async (mediaIds) => {
    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      throw new BadRequestError('mediaIds must be a non-empty array');
    }

    const urls = [];
    for (const id of mediaIds) {
      try {
        const media = await Media.findById(id);
        if (media) {
          const url = `/media/file/${media._id}`;
          urls.push({ mediaId: id, url, expiresAt: new Date(Date.now() + config.PRESIGNED_URL_TTL * 1000) });
        }
      } catch (e) {
        // Bỏ qua lỗi với từng ID đơn lẻ (ảnh bị xóa, v.v.)
      }
    }
    return urls;
  },
  
  checkHealth: async () => {
    await minioService.checkHealth();
  }
};
