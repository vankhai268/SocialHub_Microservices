import sharp from 'sharp';
import { config } from '../config/index.js';

export const imageProcessingService = {
  /**
   * Process raw image buffer and generate 3 variants: original, medium, thumbnail.
   * Returns null if processing fails or for animated GIF.
   */
  processImage: async (buffer, mimeType) => {
    if (mimeType === 'image/gif') {
      return null;
    }

    try {
      const original = await sharp(buffer)
        .resize({ width: config.IMAGE_MAX_WIDTH_ORIGINAL, withoutEnlargement: true })
        .webp({ quality: config.IMAGE_QUALITY_ORIGINAL })
        .toBuffer();

      const medium = await sharp(buffer)
        .resize({ width: config.IMAGE_MAX_WIDTH_MEDIUM, withoutEnlargement: true })
        .webp({ quality: config.IMAGE_QUALITY_MEDIUM })
        .toBuffer();

      const thumbnail = await sharp(buffer)
        .resize({ width: config.IMAGE_MAX_WIDTH_THUMBNAIL, withoutEnlargement: true })
        .webp({ quality: config.IMAGE_QUALITY_THUMBNAIL })
        .toBuffer();

      return { original, medium, thumbnail };
    } catch (err) {
      console.warn('⚠️ [ImageProcessing] Failed to process image with sharp, falling back to raw:', err.message);
      return null;
    }
  },

  /**
   * Process single avatar image: square crop 400x400
   */
  processAvatar: async (buffer) => {
    try {
      return await sharp(buffer)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err) {
      console.warn('⚠️ [ImageProcessing] Failed to process avatar with sharp:', err.message);
      return null;
    }
  }
};
