# 🚀 Developer Guide — SocialHub Microservices

> 📋 Hướng dẫn thiết lập và phát triển dự án. Đọc kỹ trước khi bắt đầu.

---

## ⚡ Quick Start

### Step 1 — Cài đặt Git

| OS | Cách cài |
|----|----------|
| **Windows** | Tải từ https://git-scm.com/download/win → cài với mặc định |
| **macOS** | Mở Terminal → gõ `git --version` (tự cài nếu thiếu) |
| **Linux** | `sudo apt install git` |

Kiểm tra:
```bash
git --version
# → git version 2.x.x
```

### Step 2 — Cài đặt Docker Desktop

Tải và cài từ https://docs.docker.com/get-docker/

Kiểm tra:
```bash
docker --version
# → Docker version 2x.x.x

docker compose version
# → Docker Compose version v2.x.x
```

> ⚠️ Trên Windows, đảm bảo Docker Desktop đang chạy (icon 🐳 trên taskbar).

### Step 3 — Clone và chạy

```bash
git clone <repo-url>
cd <project-folder>

# Copy file cấu hình môi trường
cp .env.example .env   # macOS/Linux
# hoặc:
Copy-Item .env.example .env   # Windows PowerShell

# Khởi động toàn bộ hệ thống
docker compose up --build
```

---

## 📝 Development Workflow

### Phase 1: Analysis & Design

1. Đọc `GETTING_STARTED.md` để hiểu cấu trúc project
2. Hoàn thiện `docs/analysis-and-design-ddd.md`
3. Xác định các services cần thiết cho domain của bạn

### Phase 2: Architecture & API

1. Chọn patterns và hoàn thiện `docs/architecture.md`
2. Thiết kế API trong `docs/api-specs/`

### Phase 3: Implementation

1. Chọn tech stack cho từng service
2. Cập nhật Dockerfile cho mỗi service
3. Implement `GET /health` trong **mọi service** (làm đầu tiên!)
4. Implement business logic và các API endpoints
5. Cấu hình Gateway routing
6. Xây dựng Frontend

### Phase 4: Finalization

1. Verify `docker compose up --build` chạy thành công
2. Cập nhật `README.md` với thông tin project
3. Cập nhật `readme.md` của từng service

---

## 🔍 Verification Checklist

```bash
# Cold start — build mọi thứ từ đầu
docker compose down --volumes --remove-orphans
docker compose up --build

# Sau khi tất cả services báo healthy:
curl http://localhost:8080          # Gateway
curl http://localhost:5001/health   # user-service     → {"status": "ok"}
curl http://localhost:5002/health   # friend-service   → {"status": "ok"}
curl http://localhost:5003/health   # post-service     → {"status": "ok"}
curl http://localhost:5004/health   # chat-service     → {"status": "ok"}
curl http://localhost:5005/health   # media-service    → {"status": "ok"}
curl http://localhost:5006/health   # notification-service → {"status": "ok"}
curl http://localhost:3000          # Frontend
```

**Pass criteria:**
- Tất cả containers khởi động không có lỗi ngay lần đầu
- Mọi `GET /health` trả về `{"status": "ok"}` với HTTP 200
- Ít nhất một business flow hoàn chỉnh (create → read → update) hoạt động qua Gateway
- Frontend hiển thị UI (không phải trang trắng hoặc lỗi)

---

## 🎯 Key Tips

| # | Tip | Lý do |
|---|-----|-------|
| 1 | `GET /health` là endpoint đầu tiên cần làm | Xác nhận service chạy được trong Docker |
| 2 | Chạy `docker compose up --build` thường xuyên | Đừng đợi đến cuối mới test |
| 3 | Dùng service names, không dùng `localhost` | Dùng `http://service-a:5001` thay vì `http://localhost:5001` |
| 4 | Không hardcode mật khẩu trong code | Dùng `.env` cho mọi cấu hình |
| 5 | Commit thường xuyên | Dễ rollback, theo dõi tiến độ |
| 6 | Dùng AI tools để hỗ trợ | Xem `.ai/vibe-coding-guide.md` |

---

## ❓ Common Errors

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `docker: command not found` | Docker Desktop chưa cài | Cài từ https://docs.docker.com/get-docker/ |
| `Cannot connect to Docker daemon` | Docker Desktop chưa chạy | Mở Docker Desktop và đợi icon 🐳 |
| `port is already in use` | Port đã được dùng bởi app khác | Tắt app đó hoặc đổi port trong `docker-compose.yml` |
| Service A không gọi được Service B | Dùng `localhost` thay vì service name | Đổi thành `http://service-b:5002` |
| `git push` bị reject | Remote có thay đổi chưa pull về | Chạy `git pull --rebase` rồi push lại |

---

## 📚 References

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [MinIO SDK for Node.js](https://min.io/docs/minio/linux/developers/javascript/minio-javascript.html)
- [Mongoose Docs](https://mongoosejs.com/docs/)
