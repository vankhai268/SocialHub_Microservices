# Kế hoạch triển khai Giao diện Nhắn tin Thời gian thực (Realtime Chat Widget)

Tài liệu này mô tả kế hoạch chi tiết xây dựng ô nhắn tin thời gian thực ở góc phải màn hình (phong cách Facebook) tích hợp dịch vụ **`chat-service`** mới được kéo về.

---

## 1. Phân tích API & Sự kiện của `chat-service`

### 1.1. REST APIs định tuyến qua Gateway
*   `POST /api/conversations`: Tạo mới hoặc lấy thông tin cuộc trò chuyện 1-1 với một người bạn `{ participantId }`. Trả về `conversationId`.
*   `GET /api/conversations/:id/messages`: Lấy lịch sử tin nhắn của cuộc trò chuyện (hỗ trợ phân trang cuộn ngược).

### 1.2. WebSockets (Socket.IO) qua Gateway
*   **Sự kiện gửi lên (Emit)**:
    *   `message:send`: Gửi tin nhắn `{ conversationId, content, type = 'text', mediaId }`.
    *   `message:read`: Đánh dấu đã đọc `{ conversationId, messageId }`.
    *   `typing:start` / `typing:stop`: Gửi tín hiệu đang gõ chữ `{ conversationId }`.
    *   `conversation:join`: (Sự kiện mới cần thêm vào backend) Yêu cầu kết nối socket vào phòng chat cụ thể `{ conversationId }`.
*   **Sự kiện nhận về (Listen)**:
    *   `message:received`: Nhận tin nhắn mới trong phòng chat.
    *   `message:read:ack`: Xác nhận đối phương đã đọc tin nhắn.
    *   `typing:indicator`: Trạng thái đối phương đang gõ chữ `{ conversationId, userId, displayName, isTyping }`.
    *   `user:online` / `user:offline`: Trạng thái bạn bè trực tuyến/ngoại tuyến.

---

## 2. Các thay đổi cần thực hiện đối với Backend & Gateway

### Bước 2.1: Sửa API Gateway (`gateway/src/server.js`)
*   Gom các listener của sự kiện `upgrade` thành một hàm duy nhất để định tuyến dựa trên đường dẫn:
    *   `/chat-socket/` -> proxy sang `chat-service`
    *   `/socket.io/` -> proxy sang `notification-service`

### Bước 2.2: Sửa Chat Service Socket Configuration
*   **`services/chat-service/src/socket/index.js`**: Đổi thuộc tính `path` từ `/socket.io/` thành `/chat-socket/`.
*   **`services/chat-service/src/socket/message.handler.js`**:
    Thêm sự kiện `conversation:join` để tự động gán socket vào room:
    ```javascript
    socket.on('conversation:join', ({ conversationId }) => {
      socket.join(`conv:${conversationId}`);
      console.log(`🔌 Socket joined room conv:${conversationId}`);
    });
    ```

---

## 3. Các thay đổi đối với Frontend

### Bước 3.1: Cập nhật `src/context/SocketContext.jsx`
*   Khởi tạo song song 2 kết nối socket độc lập:
    *   `notificationSocket` (path: `/socket.io/`)
    *   `chatSocket` (path: `/chat-socket/`)
*   Cung cấp cả 2 socket này qua Context để các trang/component sử dụng.

### Bước 3.2: Tạo Component Thanh bạn bè bên phải (`src/components/ChatWidget.jsx`)
*   Hiển thị danh sách bạn bè ở bên phải màn hình (cố định/right sidebar).
*   Hiển thị trạng thái Online/Offline bằng chấm tròn xanh/xám nhận được từ sự kiện `user:online` và `user:offline` của `chatSocket`.
*   Khi click vào một người bạn -> gọi API `/conversations` để lấy `conversationId` và mở ô chat tương ứng ở dưới cùng góc phải.

### Bước 3.3: Tạo Component Hộp chat nổi (`src/components/ChatBox.jsx`)
*   Hộp thoại nhỏ hiển thị tin nhắn chat:
    *   Lấy tin nhắn lịch sử khi vừa mở hộp.
    *   Bắt sự kiện gõ phím để gửi sự kiện `typing:start`/`stop`.
    *   Hiện chỉ báo đối phương đang nhập tin nhắn.
    *   Bấm Enter gửi tin nhắn (`message:send`) và tự động cuộn giao diện tin nhắn xuống cuối.
    *   Nút đóng hộp chat.

### Bước 3.4: Tích hợp vào Layout chính (`src/components/Layout.jsx`)
*   Gắn `<ChatWidget />` vào bố cục chính để luôn hiển thị ở các trang được bảo vệ.
