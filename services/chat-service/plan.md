# Implementation Plan: chat-service (Messaging)

## Mục tiêu
Xây dựng `chat-service` từ đầu theo đúng thiết kế DDD và API spec trong tài liệu dự án. Service này chịu trách nhiệm:
- Nhắn tin 1-1 (Direct Conversations)
- Nhóm chat (Group Chat)
- Realtime messaging qua **Socket.IO**
- Typing indicators, read receipts, online presence
- Phát sự kiện `message.sent` và `group.member.added` qua Redis Pub/Sub cho `notification-service`

## Nguồn tham chiếu
- `docs/api-specs/chat-service.yaml` — Full OpenAPI + Socket.IO spec
- `docs/architecture.md` — System architecture
- `docs/analysis-and-design-ddd.md` — DDD analysis (Flow 4, Section 3.2)
- `.ai/AGENTS.md` — Coding constraints

## Tech Stack

| Component | Choice | Lý do |
|-----------|--------|-------|
| Runtime | Node.js 20 (ESM) | Đồng nhất với các service khác |
| Framework | Express v4 | REST API endpoints |
| Realtime | Socket.IO v4 | WebSocket abstraction, rooms, auto-reconnect |
| Database | MongoDB (Mongoose) | Document-based, linh hoạt cho messages |
| Cache/Pub-Sub | Redis (ioredis) | Online presence, event publishing |
| Socket.IO Adapter | @socket.io/redis-adapter | Horizontal scaling cho Socket.IO |
| Base Image | node:20-slim | Đồng nhất với post-service |

## Quyết định thiết kế
- **Gateway WebSocket proxy (Option B)**: Gateway sẽ proxy cả REST lẫn WebSocket tới chat-service. Client kết nối Socket.IO qua Gateway (ws://localhost:8080) thay vì trực tiếp tới port 5004. Chuẩn hơn và single entry point.

## Kiến trúc Clean Architecture

```
services/chat-service/
├── Dockerfile
├── .dockerignore
├── package.json
├── plan.md
├── readme.md
└── src/
    ├── server.js                 # Entry point — HTTP + Socket.IO server
    ├── app.js                    # Express setup — middleware, REST routes
    ├── config/
    │   ├── index.js              # Environment variables
    │   ├── db.js                 # MongoDB connection (Mongoose)
    │   └── redis.js              # Redis clients (cache + publisher)
    ├── models/
    │   ├── conversation.model.js # Mongoose: Conversation (1-1 + group ref)
    │   ├── message.model.js      # Mongoose: Message
    │   └── group.model.js        # Mongoose: GroupChat
    ├── services/
    │   ├── conversation.service.js
    │   ├── message.service.js
    │   └── group.service.js
    ├── controllers/
    │   ├── conversation.controller.js
    │   ├── message.controller.js
    │   └── group.controller.js
    ├── routes/
    │   ├── conversation.routes.js
    │   └── group.routes.js
    ├── socket/
    │   ├── index.js              # Socket.IO server setup + Redis adapter
    │   ├── auth.handler.js       # JWT validation on handshake
    │   ├── message.handler.js    # message:send, message:read events
    │   ├── typing.handler.js     # typing:start, typing:stop events
    │   └── presence.handler.js   # online/offline tracking
    ├── middleware/
    │   └── auth.js               # REST route JWT extraction (x-user-id)
    └── utils/
        ├── error.js              # Custom error classes
        └── api.js                # Inter-service REST calls (user-service)
```

## Proposed Changes

### Phase 1: Project Setup
#### [NEW] `services/chat-service/package.json`
Dependencies: `express`, `socket.io`, `mongoose`, `ioredis`, `@socket.io/redis-adapter`, `axios`, `dotenv`, `cors`
DevDependencies: `nodemon`

#### [NEW] `services/chat-service/Dockerfile`
Base image `node:20-slim`, cài openssl, expose port 5000.

#### [NEW] `services/chat-service/.dockerignore`
Loại trừ `node_modules`, `.env`, `.git`.

---

### Phase 2: Config & Database
#### [NEW] `src/config/index.js`
Export tất cả env vars: `PORT`, `MONGO_URI`, `REDIS_URL`, `USER_SERVICE_URL`.

#### [NEW] `src/config/db.js`
Kết nối Mongoose tới MongoDB database `socialhub_chat` (DB riêng theo pattern Database-per-service).

#### [NEW] `src/config/redis.js`
Tạo 2 Redis clients: `redisClient` (cache/presence) và `redisPublisher` (pub/sub events).

---

### Phase 3: Mongoose Models
#### [NEW] `src/models/conversation.model.js`
```
Conversation {
  type: 'direct' | 'group',
  participants: [{ userId, joinedAt }],
  groupRef: ObjectId (ref Group, nullable),
  lastMessage: { content, senderId, senderName, createdAt },
  createdAt, updatedAt
}
Index: participants.userId (compound)
```

#### [NEW] `src/models/message.model.js`
```
Message {
  conversationId: ObjectId (ref Conversation),
  senderId: UUID string,
  senderName: string,
  senderAvatar: string (nullable),
  content: string,
  type: 'text' | 'image',
  mediaUrl: string (nullable),
  readBy: [{ userId, readAt }],
  createdAt
}
Index: conversationId + createdAt (compound, desc)
```

#### [NEW] `src/models/group.model.js`
```
GroupChat {
  name: string,
  avatarUrl: string (nullable),
  members: [{ userId, displayName, avatarUrl, role: 'admin'|'member', joinedAt }],
  memberCount: number,
  conversationId: ObjectId (ref Conversation),
  createdAt
}
```

---

### Phase 4: REST API (Services + Controllers + Routes)

#### Conversation endpoints:
| Method | Path | Handler |
|--------|------|---------|
| GET | `/conversations` | Danh sách conversations của user (paginated) |
| POST | `/conversations` | Tạo conversation 1-1 (idempotent) |
| GET | `/conversations/:id/messages` | Lịch sử tin nhắn (cursor-based pagination) |

#### Group endpoints:
| Method | Path | Handler |
|--------|------|---------|
| POST | `/groups` | Tạo nhóm chat |
| GET | `/groups/:id` | Thông tin nhóm |
| PUT | `/groups/:id` | Sửa tên/avatar nhóm (admin only) |
| POST | `/groups/:id/members` | Thêm thành viên (admin only) |
| DELETE | `/groups/:id/members/:userId` | Xóa thành viên |
| POST | `/groups/:id/leave` | Rời nhóm |

---

### Phase 5: Socket.IO Realtime

#### [NEW] `src/socket/index.js`
- Khởi tạo Socket.IO server gắn vào HTTP server
- Gắn Redis adapter (`@socket.io/redis-adapter`) để hỗ trợ multi-instance
- Khi connect: validate JWT → join room `user:{userId}` + tất cả conversation rooms
- Khi disconnect: xóa online presence

#### [NEW] `src/socket/auth.handler.js`
- Middleware: extract JWT từ `socket.handshake.auth.token`
- Verify JWT, gắn `socket.userId` và `socket.displayName`

#### [NEW] `src/socket/message.handler.js`
- `message:send` → Lưu message vào MongoDB → Emit `message:received` tới conversation room → Nếu recipient offline → Publish Redis `message.sent`
- `message:read` → Update `readBy` trong MongoDB → Emit `message:read:ack` tới conversation room

#### [NEW] `src/socket/typing.handler.js`
- `typing:start` → Broadcast `typing:indicator` {isTyping: true} tới conversation room (trừ sender)
- `typing:stop` → Broadcast `typing:indicator` {isTyping: false}

#### [NEW] `src/socket/presence.handler.js`
- On connect: Set Redis key `online:{userId}` (TTL 5 phút)
- Heartbeat: Gia hạn TTL mỗi 3 phút
- On disconnect: Xóa key → Broadcast `user:offline`

---

### Phase 6: Integration

#### [MODIFY] `docker-compose.yml`
Uncomment section `chat-service`, thêm:
```yaml
chat-service:
  build: ./services/chat-service
  ports:
    - "${CHAT_SERVICE_PORT:-5004}:5000"
  env_file:
    - .env
  environment:
    MONGO_URI: mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017/socialhub_chat?authSource=admin
  depends_on:
    mongo:
      condition: service_healthy
    redis:
      condition: service_healthy
```

#### [MODIFY] `gateway/src/routes/gateway.routes.js`
Thêm routes REST chuyển tiếp cho chat-service:
```js
// --- chat-service routes ---
router.use('/conversations', protectRoute, mapToChatService);
router.use('/groups', protectRoute, mapToChatService);
```

#### [MODIFY] `gateway/src/server.js`
Thêm WebSocket proxy: Gateway sẽ tạo thêm một Socket.IO server instance, khi client connect tới Gateway, nó sẽ forward connection tới `chat-service:5000` bằng cách sử dụng `http-proxy` hoặc `socket.io-client` relay.

#### [NEW] `services/chat-service/readme.md`
Tài liệu đầy đủ cho chat-service.

---

## Verification Plan

### Automated
- `docker compose up --build` thành công, chat-service healthy
- `curl http://localhost:5004/health` → `{"status": "ok"}`

### Manual (Postman + Socket.IO Client)
1. **REST**: Tạo conversation 1-1, tạo group, lấy danh sách conversations
2. **Socket.IO**: Kết nối 2 client qua Gateway (ws://localhost:8080), gửi tin nhắn qua lại, verify typing indicators
3. **Redis Events**: Kiểm tra `message.sent` event được publish khi recipient offline
