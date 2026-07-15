# media-service

> **Bounded Context:** Media — Quản lý toàn bộ vòng đời của file media trong hệ thống SocialHub.

---

## Overview

`media-service` chịu trách nhiệm:

- **Upload** file ảnh (JPG, PNG, GIF, WEBP) và video (MP4, WEBM, MOV, AVI) lên MinIO Object Storage
- **Tự động xử lý & Nén Đa Biến Thể (Multi-Variant Image Compression)**: Sử dụng `sharp` tạo ra 3 biến thể chất lượng cao WebP (`original` - 2048px 92%, `medium` - 1080px 88%, `thumbnail` - 200px 75%)
- **Lưu trữ Metadata** (tên file, kích thước gốc, dung lượng nén, định dạng, người upload, các variants) vào MongoDB
- **Cấp phát Stream / Proxied URLs**: Phục vụ ảnh trực tiếp kèm header HTTP Browser Cache dài hạn
- **Xóa** file khỏi MinIO và metadata khỏi MongoDB

Trong kiến trúc hệ thống, mọi request từ client đều đi qua **API Gateway** (cổng 8080), Gateway sẽ validate JWT và inject `x-user-id` header trước khi forward sang service này.

---

## Tech Stack

| Component  | Choice                          |
|------------|---------------------------------|
| Language   | Node.js 20 Slim (ES Modules)    |
| Framework  | Express v5                      |
| Database   | MongoDB (via Mongoose)          |
| Storage    | MinIO (S3-compatible)           |
| Image Engine | `sharp` (^0.33.5 - C++ libvips) |
| Upload     | Multer (memoryStorage)          |
| Port       | `5000` (internal) / `5005` (host) |
| Base Image | `node:20-slim` (Debian — tránh lỗi DNS của Alpine) |

---

## API Endpoints

| Method | Endpoint              | Description                          | Auth           |
|--------|-----------------------|--------------------------------------|----------------|
| GET    | `/health`             | Kiểm tra trạng thái service và MinIO | Không cần      |
| POST   | `/media/upload`       | Upload & nén file ảnh/video          | `x-user-id`    |
| GET    | `/media/file/:id`     | Tải/Hiển thị file nhị phân (hỗ trợ `?variant=thumbnail\|medium\|original`) | Không cần |
| GET    | `/media/:id`          | Lấy metadata của file                | `x-user-id`    |
| GET    | `/media/:id/url`      | Lấy relative proxy URL để tải ảnh    | `x-user-id`    |
| DELETE | `/media/:id`          | Xóa file (chỉ chủ sở hữu)            | `x-user-id`    |
| POST   | `/media/batch-urls`   | Lấy relative proxy URLs cho nhiều file| `x-user-id`   |

> Full API specification: [`docs/api-specs/media-service.yaml`](../../docs/api-specs/media-service.yaml)

---

## Kiến Trúc Xử Lý & Nén Ảnh (Multi-Variant Architecture)

```
[ Client (Browser / App) ]
  │  (1. Client-Side Pre-Compression: 10MB ➔ ~400KB qua HTML5 Canvas)
  ▼
POST /media/upload
  │
  ├─ Multer nhận file buffer trong bộ nhớ RAM
  ├─ Tầng Image Processing Service (sharp):
  │     ├── original  ➔ width max 2048px, quality 92% WebP
  │     ├── medium    ➔ width max 1080px (Full HD), quality 88% WebP
  │     └── thumbnail ➔ width max 200px, quality 75% WebP
  ├─ Upload 3 biến thể vào MinIO S3 Bucket (private)
  ├─ Lưu Metadata & thông số tỷ lệ nén (compressionRatio) vào MongoDB
  └─ Trả về Metadata JSON kèm mediaId
```

---

## Project Structure

```
media-service/
├── Dockerfile
├── .dockerignore
├── package.json
├── readme.md
└── src/
    ├── server.js                    # Entry point — kết nối DB, MinIO, khởi động server
    ├── app.js                       # Express setup — middleware, routes, error handler
    ├── config/
    │   ├── index.js                 # Biến môi trường & cấu hình nén sharp
    │   └── db.js                    # Kết nối MongoDB với Mongoose
    ├── models/
    │   └── media.model.js           # Mongoose Schema cho MediaAsset (lưu variants & compressionRatio)
    ├── services/
    │   ├── minio.service.js         # Thao tác với MinIO S3
    │   ├── image-processing.service.js # Nén ảnh đa biến thể bằng sharp (WebP)
    │   └── media.service.js         # Logic nghiệp vụ & tương tác MongoDB
    ├── middlewares/
    │   └── upload.middleware.js     # Multer config — file type + size validation
    ├── controllers/
    │   └── media.controller.js      # Request handlers & Streaming Proxies
    ├── routes/
    │   └── media.routes.js          # Route definitions
    └── utils/
        └── error.js                 # Custom error classes (AppError, NotFoundError, ...)
```

---

## Environment Variables

| Variable                    | Description                                  | Default                    |
|-----------------------------|----------------------------------------------|----------------------------|
| `PORT`                      | Port server lắng nghe                        | `5000`                     |
| `MONGO_URI`                 | MongoDB connection string                    | `mongodb://localhost:27017/socialhub-media` |
| `MINIO_ENDPOINT`            | Hostname của MinIO server                    | `localhost`                |
| `MINIO_PORT`                | Port MinIO API                               | `9000`                     |
| `MINIO_USE_SSL`             | Dùng HTTPS cho MinIO không                   | `false`                    |
| `MINIO_ACCESS_KEY`          | MinIO access key (username)                  | `minioadmin`               |
| `MINIO_SECRET_KEY`          | MinIO secret key (password)                  | `minioadmin`               |
| `MINIO_BUCKET_NAME`         | Tên bucket chứa ảnh                          | `socialhub-media`          |
| `PRESIGNED_URL_TTL`         | Thời hạn của Presigned URL (giây)            | `900` (15 phút)            |
| `MAX_FILE_SIZE`             | Giới hạn dung lượng ảnh (bytes)              | `10485760` (10MB)          |
| `MAX_VIDEO_SIZE`            | Giới hạn dung lượng video (bytes)             | `104857600` (100MB)        |
| `IMAGE_QUALITY_ORIGINAL`    | Chất lượng nén WebP cho ảnh original (%)     | `92`                       |
| `IMAGE_QUALITY_MEDIUM`      | Chất lượng nén WebP cho ảnh medium Full HD (%) | `88`                       |
| `IMAGE_QUALITY_THUMBNAIL`   | Chất lượng nén WebP cho ảnh thumbnail (%)    | `75`                       |
| `IMAGE_MAX_WIDTH_ORIGINAL`  | Độ rộng tối đa bản original (px)             | `2048`                     |
| `IMAGE_MAX_WIDTH_MEDIUM`    | Độ rộng tối đa bản medium Full HD (px)       | `1080`                     |
| `IMAGE_MAX_WIDTH_THUMBNAIL` | Độ rộng tối đa bản thumbnail (px)            | `200`                      |

---

## Running Locally

```bash
# Từ thư mục gốc của project — chỉ khởi động media-service + minio + mongo
docker compose up --build media-service

# Kiểm tra health
curl http://localhost:5005/health
# → {"status":"ok","service":"media-service"}

# Upload ảnh
curl -X POST http://localhost:5005/media/upload \
  -F "file=@./test.jpg" \
  -H "x-user-id: user-123"

# Lấy luồng ảnh Full HD
curl http://localhost:5005/media/file/{id}?variant=medium

# Lấy luồng ảnh 2K Original nét căng cho Lightbox
curl http://localhost:5005/media/file/{id}?variant=original
```

---

## Logging & Caching Behavior
- **HTTP Request Logger**: Logging request bằng `morgan('dev')`.
- **Cache-Control & ETags**: Luồng stream ảnh nhị phân (`/media/file/:id`) đính kèm header HTTP Caching dài hạn (`Cache-Control: public, max-age=31536000, immutable`) giúp trình duyệt lưu cache ảnh trực tiếp trên thiết bị client, tối ưu tốc độ cuộn Feed và tải ô Chat.
