export const config = {
  // Server config
  PORT: process.env.PORT || 5000,
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  
  // MongoDB config
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/socialhub-media',

  // MinIO config
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT || 'localhost',
  MINIO_PORT: parseInt(process.env.MINIO_PORT || '9000', 10),
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY || 'minioadmin',
  MINIO_BUCKET_NAME: process.env.MINIO_BUCKET_NAME || 'socialhub-media',
  
  // Business logic config
  PRESIGNED_URL_TTL: parseInt(process.env.PRESIGNED_URL_TTL || '900', 10), // 15 phút
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10),      // 10MB mặc định cho ảnh
  MAX_VIDEO_SIZE: parseInt(process.env.MAX_VIDEO_SIZE || '104857600', 10),   // 100MB cho video

  // Image Processing config
  IMAGE_QUALITY_ORIGINAL: parseInt(process.env.IMAGE_QUALITY_ORIGINAL || '92', 10),
  IMAGE_QUALITY_MEDIUM: parseInt(process.env.IMAGE_QUALITY_MEDIUM || '88', 10),
  IMAGE_QUALITY_THUMBNAIL: parseInt(process.env.IMAGE_QUALITY_THUMBNAIL || '75', 10),
  IMAGE_MAX_WIDTH_ORIGINAL: parseInt(process.env.IMAGE_MAX_WIDTH_ORIGINAL || '2048', 10),
  IMAGE_MAX_WIDTH_MEDIUM: parseInt(process.env.IMAGE_MAX_WIDTH_MEDIUM || '1080', 10),
  IMAGE_MAX_WIDTH_THUMBNAIL: parseInt(process.env.IMAGE_MAX_WIDTH_THUMBNAIL || '200', 10),

  // Định dạng được phép (có thể override qua .env)
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
};
