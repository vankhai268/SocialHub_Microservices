# Notification Service — Architecture & Operations Guide

Dịch vụ quản lý và đẩy thông báo thời gian thực cho hệ thống SocialHub.

---

## 📋 1. Kiến Trúc Hoạt Động (Architecture & Event Flow)

Dịch vụ sử dụng mô hình kết hợp **Redis Pub/Sub** (để lắng nghe các sự kiện thô bất đồng bộ với độ trễ cực thấp) và **RabbitMQ** (để xếp hàng đợi đảm bảo tính bền vững - durability - của thông báo ngay cả khi service tạm dừng hoạt động).

### Sơ Đồ Quy Trình Gửi Thông Báo (Event Pipeline)

```
[Các Dịch Vụ Khác] 
   │ (Ví dụ: friend-service, post-service, chat-service)
   ├─► Phát sự kiện thô lên kênh Redis Pub/Sub tương ứng (VD: 'post.liked', 'message.sent')
   │
   ▼
[Event Bridge (Redis Subscriber)] ──── (Trong Notification Service)
   │ 
   ├─► Nhận sự kiện từ Redis Pub/Sub.
   ├─► Bọc dữ liệu thành Envelope JSON chuẩn hóa.
   ├─► Đưa vào hàng đợi RabbitMQ bền vững: 'notifications-queue'
   │
   ▼
[RabbitMQ Broker Container] (Port 5672) ─ Hàng đợi bền vững lưu trữ sự kiện tạm thời.
   │
   ▼
[MQ Consumer Worker] ─────────────────── (Trong Notification Service)
   │
   ├─► Nhận sự kiện từ hàng đợi 'notifications-queue'.
   ├─► Gọi REST API tới user-service (POST /api/users/batch) lấy thông tin Actor (displayName, avatarUrl).
   ├─► Lưu trữ dữ liệu thông báo hoàn chỉnh vào MongoDB.
   ├─► Cập nhật và đẩy thông tin Socket.IO:
   │     ├─ Emits 'notification:new' tới Room `user:{userId}` (nếu người nhận online).
   │     └─ Emits 'notification:count' cập nhật số lượng tin chưa đọc.
   │
   ▼
[Socket.IO Client (Browser)]
```

### Các Kênh Sự Kiện Được Hỗ Trợ (Event Types)

| Nguồn Sự Kiện | Kênh Redis | Kiểu Thông Báo (Mongo) | Mô Tả Nội Dung |
|---|---|---|---|
| **friend-service** | `friend.request.sent` | `friend_request` | `<Actor> đã gửi lời mời kết bạn.` |
| **friend-service** | `friend.request.accepted` | `friend_accepted` | `<Actor> đã chấp nhận lời mời kết bạn.` |
| **post-service** | `post.liked` | `post_liked` | `<Actor> đã thích bài viết của bạn.` |
| **post-service** | `post.commented` | `post_commented` | `<Actor> đã bình luận bài viết của bạn.` |
| **post-service** | `post.shared` | `post_shared` | `<Actor> đã chia sẻ bài viết của bạn.` |
| **chat-service** | `message.sent` | `new_message` | `<Actor> đã gửi tin nhắn: "<preview>"` |
| **chat-service** | `group.member.added` | `group_added` | `<Actor> đã thêm bạn vào nhóm "<groupName>".` |

---

## 🔌 2. Kết Nối WebSockets Qua Gateway

Client thiết lập kết nối thời gian thực qua Gateway:
- **Địa chỉ**: `ws://localhost:8080`
- **Đường dẫn (Path)**: `/notification/socket.io/` (Gateway sẽ tự động map và loại bỏ tiền tố này khi chuyển tiếp tới `notification-service` ở cổng `5006`).
- **Handshake Auth**: `{ "token": "Bearer <JWT-Access-Token>" }`

---

## 📊 3. Hướng Dẫn Giám Sát Qua Giao Diện Quản Trị RabbitMQ

Khi docker infrastructure đang chạy (`docker compose up -d`), bạn có thể giám sát toàn bộ hoạt động xếp hàng đợi của thông báo trực tiếp qua RabbitMQ Management Console.

### Cách Truy Cập:
- **Đường dẫn**: [http://localhost:15672](http://localhost:15672)
- **Tài khoản mặc định**: 
  - *Username*: `socialhub`
  - *Password*: `socialhub_secret`

### Các Điểm Giám Sát Quan Trọng (Observation Guides):

#### 1. Theo Dõi Hàng Đợi (Queues):
- Truy cập tab **Queues and Streams** từ menu trên cùng.
- Bạn sẽ nhìn thấy hàng đợi tên là **`notifications-queue`**.
- Các thông số cần quan tâm:
  - **State**: Trạng thái hàng đợi (thường là `running`).
  - **Ready**: Số lượng thông điệp đang nằm trong hàng đợi chờ được Consumer xử lý (nếu số này tăng cao liên tục, chứng tỏ consumer đang xử lý chậm hoặc đang bị dừng).
  - **Unacked**: Số lượng thông điệp đã gửi cho consumer nhưng chưa nhận được phản hồi xác nhận (`ack`).
  - **Total**: Tổng số lượng thông điệp trong queue.

#### 2. Biểu Đồ Tốc Độ Xử Lý (Message Rates):
- Click trực tiếp vào hàng đợi `notifications-queue` để xem chi tiết.
- Bạn sẽ thấy biểu đồ thời gian thực hiển thị:
  - **Publish rate**: Tốc độ đẩy tin từ Event Bridge vào Queue (sự kiện mới xuất hiện).
  - **Deliver / Get rate**: Tốc độ consumer lấy tin ra và xử lý.
  - **Acknowledge rate**: Tốc độ consumer phản hồi hoàn thành xử lý.

#### 3. Test Đẩy Tin Thủ Công (Publish Message):
- Bạn có thể mô phỏng một sự kiện trực tiếp trên giao diện quản trị để test dịch vụ:
  - Cuộn xuống phần **Publish message**.
  - Phần **Payload**, nhập dữ liệu JSON mô phỏng (ví dụ về sự kiện thích bài viết):
    ```json
    {
      "channel": "post.liked",
      "payload": {
        "userId": "d748f655-46b5-4b02-aa92-3bc374828b8b",
        "postId": "postId-123-abc",
        "postAuthorId": "<your-user-uuid-currently-online>"
      },
      "bridgedAt": "2026-07-10T12:00:00.000Z"
    }
    ```
  - Click **Publish message**. Notification Service sẽ nhận được ngay lập tức, ghi nhận vào MongoDB và bắn Socket.IO realtime báo động.

#### 4. Xem Dữ Liệu Chờ Trong Queue (Get Messages):
- Cuộn xuống phần **Get messages** trong trang chi tiết queue.
- Chọn số lượng tin muốn xem ở ô **Messages**.
- Click **Get Message(s)**. Bạn có thể xem trực tiếp nội dung các tin nhắn JSON đang xếp hàng đợi mà chưa được xử lý (đặc biệt hữu ích khi debug lỗi xử lý bất đồng bộ).
