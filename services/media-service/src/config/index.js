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

  // Định dạng được phép (có thể override qua .env)
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
};
