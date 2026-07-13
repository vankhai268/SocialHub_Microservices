import * as Minio from 'minio';
import { config } from '../config/index.js';

let minioClient;

export const minioService = {
  /**
   * Khởi tạo kết nối tới MinIO
   * Tạo bucket nếu nó chưa tồn tại.
   */
  initializeMinIO: async () => {
    minioClient = new Minio.Client({
      endPoint: config.MINIO_ENDPOINT,
      port: config.MINIO_PORT,
      useSSL: config.MINIO_USE_SSL,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
    });

    try {
      const exists = await minioClient.bucketExists(config.MINIO_BUCKET_NAME);
      if (!exists) {
        await minioClient.makeBucket(config.MINIO_BUCKET_NAME, 'us-east-1');
        console.log(`Bucket ${config.MINIO_BUCKET_NAME} created successfully`);
      } else {
        console.log(`Bucket ${config.MINIO_BUCKET_NAME} already exists`);
      }
    } catch (err) {
      if (err.code === 'NoSuchBucket') {
        await minioClient.makeBucket(config.MINIO_BUCKET_NAME, 'us-east-1');
        console.log(`Bucket ${config.MINIO_BUCKET_NAME} created successfully`);
      } else {
        console.error('Error initializing MinIO:', err);
        throw err;
      }
    }
  },

  /**
   * Upload file buffer lên MinIO
   */
  uploadFile: async (objectKey, buffer, mimeType, size) => {
    const metaData = {
      'Content-Type': mimeType,
    };
    return minioClient.putObject(config.MINIO_BUCKET_NAME, objectKey, buffer, size, metaData);
  },

  /**
   * Tạo Presigned URL cho phép đọc ảnh (TTL)
   */
  generatePresignedUrl: async (objectKey, ttlSeconds) => {
    let url = await minioClient.presignedGetObject(config.MINIO_BUCKET_NAME, objectKey, ttlSeconds);
    
    // Fix: Client bên ngoài container không thể resolve host tên là "minio". 
    // Chúng ta thay nó thành "localhost" để tải được trên máy tính của bạn.
    if (config.MINIO_ENDPOINT === 'minio') {
      url = url.replace('http://minio:', 'http://localhost:');
    }
    return url;
  },

  /**
   * Lấy Stream đọc file từ MinIO
   */
  getFileStream: async (objectKey) => {
    return minioClient.getObject(config.MINIO_BUCKET_NAME, objectKey);
  },

  /**
   * Xóa file khỏi MinIO
   */
  deleteFile: async (objectKey) => {
    return minioClient.removeObject(config.MINIO_BUCKET_NAME, objectKey);
  },

  /**
   * Kiểm tra Health cho Gateway
   */
  checkHealth: async () => {
    return minioClient.bucketExists(config.MINIO_BUCKET_NAME);
  }
};
