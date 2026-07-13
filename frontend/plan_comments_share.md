# Kế hoạch triển khai Tính năng Bình luận và Chia sẻ bài viết (Comments & Sharing)

Tài liệu này phác thảo kế hoạch tích hợp tính năng Bình luận và Chia sẻ bài viết ở Frontend, bám sát các APIs hiện có của **`post-service`**.

---

## 1. Phân tích API của `post-service`

### 1.1. Bình luận (Comments)
*   `GET /api/posts/:id/comments`: Lấy danh sách bình luận của bài đăng (trả về danh sách đối tượng chứa `{ id, content, author: { displayName, avatarUrl }, created_at }`).
*   `POST /api/posts/:id/comments`: Thêm bình luận mới `{ content }`.
*   `DELETE /api/posts/:postId/comments/:commentId`: Xóa bình luận.

### 1.2. Chia sẻ bài viết (Sharing)
*   `POST /api/posts/:id/share`: Chia sẻ bài đăng gốc dưới dạng bài viết mới của chính mình kèm lời nhắn riêng `{ content: shareText }`.
*   **Cấu trúc dữ liệu bài đăng chia sẻ**:
    *   `is_shared`: true.
    *   `original_post_id`: ID của bài đăng gốc.

---

## 2. Kế hoạch triển khai từng bước ở Frontend

### Bước 2.1: Tạo Component Hộp thoại Chia sẻ bài viết (`src/components/ShareModal.jsx`)
*   Pop-up modal hiển thị khi người dùng bấm nút "Chia sẻ".
*   Hiển thị bản xem trước thu nhỏ của bài viết gốc.
*   Một ô textarea nhập lời dẫn/cảm nghĩ riêng.
*   Bấm nút "Chia sẻ ngay" -> gửi POST request đến `/api/posts/:id/share`.

### Bước 2.2: Nâng cấp `PostCard.jsx` để hiển thị bài gốc nhúng (Embedded original post)
*   Khi `post.is_shared === true` và `post.original_post_id` tồn tại:
    *   Gọi API `GET /api/posts/:originalPostId` để lấy thông tin chi tiết bài viết gốc.
    *   Nếu bài gốc cũng chứa ảnh -> gọi API lấy link ảnh gốc qua presigned URL.
    *   Hiển thị bài gốc này trong một thẻ con lồng bên trong (Nested Card) có viền đứt nét để phân định rõ ràng.

### Bước 2.3: Xây dựng khung hiển thị danh sách và bình luận
*   Khi bấm nút "Bình luận":
    *   Toggle trạng thái mở khung bình luận.
    *   Gọi API lấy danh sách bình luận về hiển thị.
*   Thiết kế ô nhập bình luận nhanh có nút bấm gửi (Submit).
*   Hiển thị danh sách bình luận gồm: avatar, tên hiển thị, nội dung bình luận, thời gian bình luận và nút Xóa (chỉ hiển thị nếu bạn là người viết bình luận đó hoặc là chủ nhân của bài đăng).
*   Bảo đảm sau khi thêm/xóa bình luận -> số lượng đếm bình luận trên bài đăng sẽ tự động tăng/giảm đồng bộ.
