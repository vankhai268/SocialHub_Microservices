# Kế hoạch triển khai Giao diện Thông báo Thời gian thực (Realtime Notifications)

Tài liệu này phác thảo kế hoạch chi tiết xây dựng hệ thống **Thông báo thời gian thực** ở Frontend, kết nối và tương tác với các API & WebSockets của **`notification-service`** qua API Gateway (cổng `8080`).

---

## 1. Phân tích API của `notification-service`

Dịch vụ thông báo cung cấp các cổng kết nối và dữ liệu sau:

### 1.1. Cấu trúc đối tượng Thông báo (Notification Object)
*   `id`: ID của thông báo.
*   `type`: Loại thông báo (`friend_request`, `friend_accepted`, `post_liked`, `post_commented`, `post_shared`).
*   `message`: Nội dung thông báo hiển thị bằng chữ.
*   `fromUser`: Thông tin người gửi hành động `{ id, displayName, avatarUrl }`.
*   `referenceId`: ID tham chiếu (ID bài viết hoặc ID lời mời kết bạn).
*   `isRead`: Trạng thái đã đọc (boolean).
*   `createdAt`: Thời gian tạo.

### 1.2. REST APIs qua Gateway
*   `GET /api/notifications`: Lấy danh sách thông báo của tôi (phân trang).
*   `GET /api/notifications/unread-count`: Lấy số lượng thông báo chưa đọc.
*   `PUT /api/notifications/:id/read`: Đánh dấu một thông báo là đã đọc.
*   `PUT /api/notifications/read-all`: Đánh dấu tất cả thông báo là đã đọc.

### 1.3. WebSockets (Socket.IO) qua Gateway
*   Đường dẫn kết nối: `http://localhost:8080` (qua Gateway), sử dụng path `/socket.io/`.
*   Yêu cầu bắt tay: Gửi kèm Access Token ở trường `token` trong thuộc tính `auth`.
*   **Sự kiện lắng nghe (Listen Events)**:
    *   `notification:received`: Nhận đầy đủ đối tượng thông báo mới khi có người tương tác.
    *   `notification:count`: Nhận số lượng thông báo chưa đọc mới nhất `{ unreadCount }`.

---

## 2. Kế hoạch triển khai từng bước (Dành cho bạn tự gõ)

### Bước 2.1: Triển khai Socket Context (`src/context/SocketContext.jsx`)
Context này quản lý kết nối Socket.IO toàn cục cho ứng dụng. Khi đăng nhập thành công, nó sẽ tự kết nối và lắng nghe sự kiện từ gateway.

*   Tạo file `src/context/SocketContext.jsx` với logic:
    1.  Import `io` từ `socket.io-client`.
    2.  Khi `accessToken` trong `AuthContext` thay đổi và hợp lệ -> Thiết lập kết nối:
        `const newSocket = io("http://localhost:8080", { auth: { token: accessToken } })`.
    3.  Lắng nghe sự kiện `notification:count` để cập nhật state `unreadCount`.
    4.  Lắng nghe sự kiện `notification:received` để hiển thị Toast thông báo nổi lên màn hình và cập nhật lại số lượng chưa đọc.
    5.  Khi ngắt kết nối (hoặc logout) -> gọi `socket.disconnect()`.

### Bước 2.2: Xây dựng Component hiển thị Thông báo nổi (Toast Alert)
*   Thiết kế giao diện thẻ thông báo nổi đẹp đẽ, bóng bẩy (Glassmorphism) trượt từ góc phải màn hình khi nhận được sự kiện `notification:received`.
*   Thẻ hiển thị avatar người gửi, nội dung tin nhắn và tự động ẩn đi sau 4 giây.

### Bước 2.3: Thêm chỉ mục thông báo chưa đọc vào Sidebar (`src/components/Layout.jsx`)
*   Import `useSocket` từ `SocketContext`.
*   Thêm icon quả chuông (`Bell`) dẫn tới đường dẫn `/notifications`.
*   Nếu `unreadCount > 0`, hiển thị một thẻ tròn màu đỏ nhỏ chứa số lượng chưa đọc ngay góc trên bên phải quả chuông.

### Bước 2.4: Tạo trang danh sách thông báo (`src/pages/Notifications.jsx`)
Trang hiển thị tất cả các thông báo trong quá khứ của người dùng:
1.  **Khi tải trang**: Gọi API `GET /api/notifications` để hiển thị. Đồng thời gọi API `GET /api/notifications/unread-count` để cập nhật số lượng.
2.  **Đầu trang**: Có nút "Đánh dấu tất cả đã đọc". Khi bấm sẽ gọi API `PUT /api/notifications/read-all` và chuyển toàn bộ thông báo về trạng thái mờ (đã đọc).
3.  **Mỗi dòng thông báo**:
    *   Hiển thị Avatar, nội dung và thời gian.
    *   Nếu thông báo chưa đọc (`isRead === false`), hiển thị một chấm tròn xanh dương biểu thị sự chú ý và nền thẻ sáng hơn.
    *   Khi click vào dòng thông báo chưa đọc: Gọi API `PUT /api/notifications/:id/read` để chuyển trạng thái thành đã đọc trên DB, sau đó điều hướng người dùng tới trang đích (nếu là `friend_request` -> sang `/friends`; nếu là bài viết -> sang trang xem chi tiết bài viết).
