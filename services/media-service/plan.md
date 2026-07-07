# Implement media-service — Task Breakdown

## Tổng quan

Implement **media-service** (Bounded Context: Media) theo đúng API spec trong [`media-service.yaml`](../../docs/api-specs/media-service.yaml).

**Tech stack**: Node.js (Express) + MinIO SDK + Multer  
**Port**: 5000 (internal) → 5005 (host)  

---

## Task 1: Project Scaffolding

Tạo cấu trúc thư mục theo DDD layers:

```
services/media-service/
├── Dockerfile
├── .dockerignore
├── package.json
├── plan.md                       # This file
├── readme.md
└── src/
    ├── app.js                    # Express app setup + middleware
    ├── server.js                 # Entry point — start server
    ├── config/
    │   └── index.js              # Env vars (MINIO_*, MAX_FILE_SIZE, etc.)
    ├── routes/
    │   └── media.routes.js       # Route definitions
    ├── controllers/
    │   └── media.controller.js   # Request handlers
    ├── services/
    │   └── minio.service.js      # MinIO client wrapper (upload, presign, delete)
    ├── middlewares/
    │   └── upload.middleware.js   # Multer config (file type/size validation)
    ├── models/
    │   └── media.model.js        # In-memory store (hoặc simple JSON file store)
    └── utils/
        └── errors.js             # Custom error classes
```

**Dependencies**: express, minio, multer, uuid, cors, helmet, morgan

---

## Task 2: MinIO Connection + Health Check

- Khởi tạo MinIO client từ env vars
- Auto-create bucket nếu chưa tồn tại (bucket name from env)
- Set bucket policy = PRIVATE
- `GET /health` → kiểm tra MinIO connectivity → `{"status": "ok"}`

**Test**: `curl http://localhost:5005/health` → 200

---

## Task 3: Upload Endpoint

- `POST /media/upload` (multipart/form-data)
- Multer middleware: validate file type (jpg, jpeg, png, gif, webp), max 10MB
- Generate unique object key: `{userId}/{uuid}.{ext}`
- Upload to MinIO private bucket via `putObject`
- Lưu metadata (id, originalName, mimeType, size, objectKey, uploadedBy, createdAt)
- Return 201 `{id, originalName, mimeType, size, uploadedBy, createdAt}`

**Test**: Upload 1 file ảnh qua Postman/curl → nhận mediaId

---

## Task 4: Presigned URL + Metadata Endpoints

- `GET /media/:id` → return metadata
- `GET /media/:id/url` → generate presigned URL (TTL 15 min) từ MinIO
- Return `{mediaId, url, expiresAt, ttlSeconds: 900}`

**Test**: 
1. Upload file → get mediaId
2. `GET /media/{mediaId}/url` → nhận presigned URL
3. Dùng presigned URL tải ảnh → thành công
4. Đợi 15 phút → presigned URL hết hạn → 403

---

## Task 5: Delete + Batch URLs + Readme

- `DELETE /media/:id` → xóa file từ MinIO + xóa metadata
- `POST /media/batch-urls` → generate presigned URLs cho nhiều mediaIds
- Viết readme.md cho service
- Test toàn bộ flow end-to-end

---

## Verification Plan

```bash
# 1. Chạy docker compose (chỉ media-service + minio)
docker compose up --build media-service minio

# 2. Health check
curl http://localhost:5005/health
# → {"status": "ok"}

# 3. Upload
curl -X POST http://localhost:5005/media/upload \
  -F "file=@test.jpg" \
  -H "x-user-id: test-user-123"
# → 201 {id, originalName, ...}

# 4. Get presigned URL
curl http://localhost:5005/media/{id}/url
# → 200 {url, expiresAt}

# 5. Download via presigned URL
curl -o downloaded.jpg "{presigned_url}"
# → 200 OK

# 6. Delete
curl -X DELETE http://localhost:5005/media/{id} \
  -H "x-user-id: test-user-123"
# → 200
```

> **Note:** Trong môi trường thực tế, `x-user-id` header sẽ được Gateway inject sau khi validate JWT. Ở giai đoạn này (chưa có Gateway), ta dùng header trực tiếp để test.
