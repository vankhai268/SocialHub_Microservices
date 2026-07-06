# Analysis and Design — Domain-Driven Design Approach

> **Project**: SocialHub — Nền tảng Mạng Xã Hội
> **Scope**: Hệ thống hoàn chỉnh — bao gồm kết bạn, đăng bài, nhắn tin, nhóm chat, thông báo, quản lý media.
>
> **Approach**: Domain-Driven Design — khám phá service boundaries thông qua domain knowledge và business semantics.

**References:**
1. *Domain-Driven Design: Tackling Complexity in the Heart of Software* — Eric Evans
2. *Microservices Patterns: With Examples in Java* — Chris Richardson
3. *Designing Data-Intensive Applications* — Martin Kleppmann

---

### Progression Overview

| Step | What you do | Output |
|------|------------|--------|
| **1.1** | Define the System Domain | Domain overview, actors, scope |
| **1.2** | Survey existing systems & tech choices | System inventory |
| **1.3** | State non-functional requirements | NFR table |
| **2.1** | Build a shared domain vocabulary | Ubiquitous Language glossary |
| **2.2** | Discover Domain Events via Event Storming | Chronological event list |
| **2.3** | Identify Commands and Actors | Command → Event mapping |
| **2.4** | Form Aggregates from related Commands/Events | Aggregate table with owned data |
| **2.5** | Draw Bounded Contexts around Aggregates | Bounded Context → service candidate |
| **2.6** | Map relationships between Bounded Contexts | Context Map diagram + relationship table |
| **2.7** | Design service interactions | Service composition diagrams |
| **3.1** | Specify service contracts | OpenAPI endpoint tables |
| **3.2** | Design internal service logic | Flowchart per service |

---

## Part 1 — Domain Discovery

### 1.1 System Domain Definition

- **Domain**: Mạng xã hội (Social Network Platform)
- **System Name**: SocialHub
- **Description**: Nền tảng mạng xã hội cho phép người dùng kết nối, chia sẻ nội dung, nhắn tin và tương tác trong thời gian thực.
- **Actors**:
  - **User (Người dùng)**: Đăng ký, đăng nhập, quản lý profile, kết bạn, đăng bài, nhắn tin, tham gia nhóm chat
  - **Admin (Quản trị viên)**: Quản lý hệ thống, moderate nội dung
- **Scope**: Hệ thống hoàn chỉnh bao gồm:
  1. Quản lý tài khoản & xác thực (đăng ký, đăng nhập, profile)
  2. Mạng lưới bạn bè (gửi/chấp nhận/từ chối lời mời, gợi ý bạn bè)
  3. Nội dung (đăng bài, like, comment, chia sẻ, newsfeed)
  4. Nhắn tin (1-1, nhóm chat, realtime qua Socket.IO)
  5. Quản lý media (upload ảnh, presigned URL xác thực)
  6. Thông báo (in-app notifications, realtime)

**System Overview Diagram:**

```mermaid
graph TB
    subgraph Actors
        U[👤 User]
        A[🔧 Admin]
    end

    subgraph "SocialHub Platform"
        AUTH[Đăng ký / Đăng nhập]
        PROFILE[Quản lý Profile]
        FRIEND[Kết bạn]
        POST[Đăng bài / Tương tác]
        CHAT[Nhắn tin / Nhóm chat]
        MEDIA[Upload Media]
        NOTI[Thông báo]
    end

    U --> AUTH
    U --> PROFILE
    U --> FRIEND
    U --> POST
    U --> CHAT
    U --> MEDIA
    U --> NOTI
    A --> AUTH
```

### 1.2 Existing Automation Systems

| System Name | Type | Current Role | Interaction Method |
|-------------|------|--------------|-------------------|
| *None* | — | — | — |

> *Dự án xây dựng từ đầu — không có hệ thống legacy.*

**Technology Choices (rationale):**

| Technology | Purpose | Justification |
|---|---|---|
| Node.js (Express) | Backend services | Non-blocking I/O phù hợp realtime chat, event-driven |
| React + Vite | Frontend SPA | Component-based UI, fast HMR, large ecosystem |
| PostgreSQL | Relational data (user, post, friendship) | ACID compliance, mature JSON support, complex queries |
| MongoDB | Document data (messages, chat) | Flexible schema cho messages, time-series queries |
| Socket.IO | Realtime communication | WebSocket abstraction, auto-reconnect, rooms/namespaces |
| MinIO | Object storage (images, media) | S3-compatible API, self-hosted, presigned URL support |
| Redis | Cache, pub/sub, session | In-memory speed, pub/sub cho Socket.IO adapter, sorted sets cho feed |

### 1.3 Non-Functional Requirements

| Requirement | Description |
|-------------|-------------|
| **Performance** | API response time < 200ms (p95). Realtime message delivery < 100ms. Newsfeed load < 500ms (cached). |
| **Security** | JWT-based authentication (access + refresh tokens). Presigned URL cho media (TTL 15 phút). HTTPS everywhere. Password hashed với bcrypt. Rate limiting trên Gateway. |
| **Scalability** | Horizontal scaling cho từng service independently. Redis adapter cho Socket.IO multi-instance. Stateless services (JWT, no server-side sessions). |
| **Availability** | Health checks cho tất cả services. Docker restart policy. Graceful shutdown handling. |
| **Data Consistency** | Eventual consistency giữa services qua Redis pub/sub events. Strong consistency trong từng service's database. |
| **Storage** | Media files tối đa 10MB/file. Presigned URL hết hạn sau 15 phút. MinIO bucket policy restrict direct access. |

---

## Part 2 — Strategic Domain-Driven Design

### 2.1 Ubiquitous Language

| Term | Definition | Example |
|------|-----------|---------|
| **User** | Một người dùng đã đăng ký tài khoản trong hệ thống | "User A đăng ký bằng email abc@mail.com" |
| **Profile** | Thông tin cá nhân của User (tên, avatar, bio) | "User cập nhật avatar trong Profile" |
| **Friend Request** | Lời mời kết bạn từ một User gửi tới User khác, trạng thái pending/accepted/rejected | "User A gửi Friend Request tới User B" |
| **Friendship** | Quan hệ bạn bè hai chiều giữa hai Users đã accepted | "User A và User B có Friendship" |
| **Post** | Bài đăng chứa text và/hoặc media, được tạo bởi một User | "User tạo Post với 2 ảnh" |
| **Like** | Hành động thể hiện sự yêu thích một Post | "User A Like Post của User B" |
| **Comment** | Phản hồi văn bản dưới một Post | "User A viết Comment trên Post" |
| **Share** | Hành động chia sẻ lại một Post lên tường của mình | "User A Share Post của User B" |
| **Feed** | Luồng bài đăng từ bạn bè, sắp xếp theo thời gian | "User xem Feed gồm Posts từ bạn bè" |
| **Conversation** | Cuộc hội thoại 1-1 giữa hai Users | "User A mở Conversation với User B" |
| **Group Chat** | Cuộc hội thoại nhiều người, có tên và danh sách thành viên | "User A tạo Group Chat '3A Friends'" |
| **Message** | Một tin nhắn trong Conversation hoặc Group Chat | "User A gửi Message 'Hello!' trong Conversation" |
| **Media Asset** | File ảnh/video được upload và lưu trữ trong hệ thống | "User upload Media Asset (avatar.jpg, 2MB)" |
| **Presigned URL** | URL có thời hạn để truy cập Media Asset, yêu cầu xác thực | "Media Service sinh Presigned URL cho ảnh, hết hạn sau 15 phút" |
| **Notification** | Thông báo tới User về một sự kiện (friend request, like, message mới) | "User B nhận Notification 'User A đã gửi lời mời kết bạn'" |
| **Online Presence** | Trạng thái online/offline của User, tracking qua Socket.IO | "User A đang Online (Online Presence = active)" |
| **JWT (Access Token)** | Token xác thực ngắn hạn (15 phút) để gọi API | "Gateway validate JWT trước khi route request" |
| **Refresh Token** | Token dài hạn (7 ngày) để lấy Access Token mới | "Client dùng Refresh Token để lấy Access Token mới" |
| **Typing Indicator** | Tín hiệu cho biết đối phương đang gõ tin nhắn | "User A thấy Typing Indicator từ User B" |
| **Member** | Một User trong Group Chat, có role (admin/member) | "User A là Member với role admin trong Group Chat" |

### 2.2 Event Storming — Domain Events

| # | Domain Event | Description | Subdomain |
|---|-------------|-------------|-----------|
| 1 | **UserRegistered** | User hoàn tất đăng ký tài khoản mới | Identity |
| 2 | **UserLoggedIn** | User đăng nhập thành công, JWT được cấp | Identity |
| 3 | **TokenRefreshed** | Access token mới được cấp từ refresh token | Identity |
| 4 | **UserLoggedOut** | User đăng xuất, token bị blacklist | Identity |
| 5 | **ProfileUpdated** | User cập nhật thông tin profile (tên, bio, avatar URL) | Identity |
| 6 | **AvatarChanged** | User thay đổi ảnh avatar | Identity |
| 7 | **FriendRequestSent** | User A gửi lời mời kết bạn tới User B | Social Graph |
| 8 | **FriendRequestAccepted** | User B chấp nhận lời mời kết bạn từ User A | Social Graph |
| 9 | **FriendRequestRejected** | User B từ chối lời mời kết bạn từ User A | Social Graph |
| 10 | **FriendRemoved** | User A hủy kết bạn với User B | Social Graph |
| 11 | **PostCreated** | User tạo bài đăng mới (text + media URLs) | Content |
| 12 | **PostUpdated** | User sửa nội dung bài đăng | Content |
| 13 | **PostDeleted** | User xóa bài đăng | Content |
| 14 | **PostLiked** | User A thích bài đăng của User B | Content |
| 15 | **PostUnliked** | User A bỏ thích bài đăng | Content |
| 16 | **CommentCreated** | User viết comment trên một Post | Content |
| 17 | **CommentDeleted** | User xóa comment | Content |
| 18 | **PostShared** | User A chia sẻ lại Post của User B | Content |
| 19 | **ConversationCreated** | Cuộc hội thoại 1-1 mới được tạo | Messaging |
| 20 | **MessageSent** | Tin nhắn được gửi trong Conversation/Group | Messaging |
| 21 | **MessageRead** | Tin nhắn được đánh dấu đã đọc | Messaging |
| 22 | **GroupChatCreated** | Nhóm chat mới được tạo | Messaging |
| 23 | **GroupMemberAdded** | Thành viên mới được thêm vào Group Chat | Messaging |
| 24 | **GroupMemberRemoved** | Thành viên bị xóa khỏi Group Chat | Messaging |
| 25 | **GroupChatUpdated** | Thông tin nhóm chat được cập nhật (tên, avatar) | Messaging |
| 26 | **MediaUploaded** | File media được upload thành công lên MinIO | Media |
| 27 | **MediaDeleted** | File media bị xóa khỏi MinIO | Media |
| 28 | **NotificationCreated** | Thông báo mới được tạo cho User | Notification |
| 29 | **NotificationRead** | User đánh dấu thông báo đã đọc | Notification |
| 30 | **NotificationsBatchRead** | User đánh dấu tất cả thông báo đã đọc | Notification |

### 2.3 Commands and Actors

| Command | Actor | Triggers Event(s) | Description |
|---------|-------|--------------------|-------------|
| **RegisterUser** | User | UserRegistered | Đăng ký tài khoản bằng email + password |
| **LoginUser** | User | UserLoggedIn | Đăng nhập bằng email + password → nhận JWT |
| **RefreshToken** | User | TokenRefreshed | Dùng refresh token để lấy access token mới |
| **LogoutUser** | User | UserLoggedOut | Đăng xuất → blacklist JWT |
| **UpdateProfile** | User | ProfileUpdated | Cập nhật tên, bio |
| **ChangeAvatar** | User | AvatarChanged | Upload ảnh avatar mới (qua media-service) |
| **SendFriendRequest** | User | FriendRequestSent, NotificationCreated | Gửi lời mời kết bạn |
| **AcceptFriendRequest** | User | FriendRequestAccepted, NotificationCreated | Chấp nhận lời mời kết bạn → tạo Friendship hai chiều |
| **RejectFriendRequest** | User | FriendRequestRejected | Từ chối lời mời kết bạn |
| **RemoveFriend** | User | FriendRemoved | Hủy kết bạn |
| **CreatePost** | User | PostCreated | Tạo bài đăng với text + media URLs |
| **UpdatePost** | User | PostUpdated | Sửa nội dung bài đăng (chỉ author) |
| **DeletePost** | User | PostDeleted | Xóa bài đăng (chỉ author) |
| **LikePost** | User | PostLiked, NotificationCreated | Thích một bài đăng |
| **UnlikePost** | User | PostUnliked | Bỏ thích bài đăng |
| **CreateComment** | User | CommentCreated, NotificationCreated | Viết comment trên Post |
| **DeleteComment** | User | CommentDeleted | Xóa comment (author hoặc post owner) |
| **SharePost** | User | PostShared, NotificationCreated | Chia sẻ lại bài đăng |
| **CreateConversation** | User | ConversationCreated | Bắt đầu cuộc hội thoại 1-1 mới |
| **SendMessage** | User | MessageSent, NotificationCreated | Gửi tin nhắn trong conversation/group |
| **MarkMessageRead** | User | MessageRead | Đánh dấu tin nhắn đã đọc |
| **CreateGroupChat** | User | GroupChatCreated | Tạo nhóm chat mới |
| **UpdateGroupChat** | User | GroupChatUpdated | Sửa tên/avatar nhóm (chỉ admin) |
| **AddGroupMember** | User | GroupMemberAdded, NotificationCreated | Thêm thành viên vào nhóm (chỉ admin) |
| **RemoveGroupMember** | User | GroupMemberRemoved | Xóa thành viên khỏi nhóm (admin) hoặc rời nhóm (member) |
| **UploadMedia** | User | MediaUploaded | Upload file ảnh lên MinIO |
| **DeleteMedia** | User | MediaDeleted | Xóa file ảnh khỏi MinIO |
| **MarkNotificationRead** | User | NotificationRead | Đánh dấu 1 thông báo đã đọc |
| **MarkAllNotificationsRead** | User | NotificationsBatchRead | Đánh dấu tất cả thông báo đã đọc |

### 2.4 Aggregates

| Aggregate | Root Entity | Commands | Domain Events | Key Business Rules |
|-----------|------------|----------|---------------|-------------------|
| **User** | User | RegisterUser, LoginUser, RefreshToken, LogoutUser | UserRegistered, UserLoggedIn, TokenRefreshed, UserLoggedOut | Email phải unique; password >= 8 ký tự; JWT access token TTL 15 phút, refresh token 7 ngày |
| **Profile** | Profile | UpdateProfile, ChangeAvatar | ProfileUpdated, AvatarChanged | Display name 2-50 ký tự; bio tối đa 500 ký tự; avatar phải là valid media URL |
| **FriendRequest** | FriendRequest | SendFriendRequest, AcceptFriendRequest, RejectFriendRequest | FriendRequestSent, FriendRequestAccepted, FriendRequestRejected | Không thể gửi lời mời cho chính mình; không thể gửi nếu đã là bạn; không thể gửi nếu đã có pending request |
| **Friendship** | Friendship | RemoveFriend | FriendRemoved | Friendship luôn hai chiều; xóa friendship cũng xóa cả hai phía |
| **Post** | Post | CreatePost, UpdatePost, DeletePost, SharePost | PostCreated, PostUpdated, PostDeleted, PostShared | Post phải có text hoặc media (không được rỗng cả hai); media URLs tối đa 10 ảnh; chỉ author mới sửa/xóa |
| **Interaction** | Like / Comment | LikePost, UnlikePost, CreateComment, DeleteComment | PostLiked, PostUnliked, CommentCreated, CommentDeleted | 1 user chỉ like 1 lần / post; comment tối đa 2000 ký tự; xóa comment: author hoặc post owner |
| **Conversation** | Conversation | CreateConversation, SendMessage, MarkMessageRead | ConversationCreated, MessageSent, MessageRead | 1-1 conversation unique giữa 2 users; chỉ participant mới gửi/đọc message |
| **GroupChat** | GroupChat | CreateGroupChat, UpdateGroupChat, AddGroupMember, RemoveGroupMember | GroupChatCreated, GroupChatUpdated, GroupMemberAdded, GroupMemberRemoved | Nhóm tối thiểu 2 thành viên; người tạo là admin; chỉ admin thêm/xóa thành viên |
| **MediaAsset** | MediaAsset | UploadMedia, DeleteMedia | MediaUploaded, MediaDeleted | File tối đa 10MB; chỉ cho phép image types (jpg, png, gif, webp); presigned URL TTL 15 phút |
| **Notification** | Notification | MarkNotificationRead, MarkAllNotificationsRead | NotificationCreated, NotificationRead, NotificationsBatchRead | Notification chỉ gửi cho user liên quan; types: friend_request, friend_accepted, post_liked, post_commented, post_shared, message_received, group_added |

### 2.5 Bounded Contexts

| Bounded Context | Aggregates Included | Responsibility | Service Candidate | Database |
|-----------------|---------------------|----------------|-------------------|----------|
| **Identity & Access** | User, Profile | Quản lý toàn bộ lifecycle người dùng: đăng ký, xác thực (JWT), quản lý profile, tìm kiếm user | `user-service` | PostgreSQL |
| **Social Graph** | FriendRequest, Friendship | Quản lý quan hệ bạn bè: gửi/chấp nhận/từ chối lời mời, danh sách bạn bè, bạn chung, gợi ý kết bạn | `friend-service` | PostgreSQL |
| **Content** | Post, Interaction (Like, Comment) | Quản lý nội dung: CRUD bài đăng, like/unlike, comment, chia sẻ, newsfeed (cached) | `post-service` | PostgreSQL |
| **Messaging** | Conversation, GroupChat | Quản lý tin nhắn realtime: hội thoại 1-1, nhóm chat, lịch sử tin nhắn, typing indicator, online presence | `chat-service` | MongoDB |
| **Media** | MediaAsset | Quản lý file media: upload lên MinIO, generate presigned URL (xác thực), xóa file | `media-service` | MinIO (S3) |
| **Notification** | Notification | Quản lý thông báo: tạo notification khi có sự kiện, đánh dấu đã đọc, realtime push qua Socket.IO | `notification-service` | MongoDB |

> **Lý do 6 Bounded Contexts:**
> - **Identity vs Social Graph**: "User" trong Identity context là tài khoản + credentials, trong Social Graph là node trong graph bạn bè → ngữ nghĩa khác nhau.
> - **Content vs Messaging**: Post là nội dung public/friends-only với interactions (like, comment). Message là nội dung private 1-1/group. Patterns rất khác (feed vs realtime stream).
> - **Media riêng biệt**: I/O intensive, cần scale riêng. Xác thực presigned URL là cross-cutting concern.
> - **Notification riêng biệt**: Nhận events từ nhiều services khác nhau (friend, post, chat). Là consumer thuần túy — loose coupling.

### 2.6 Context Map

```mermaid
graph LR
    IAC[Identity & Access<br/>user-service]
    SG[Social Graph<br/>friend-service]
    CT[Content<br/>post-service]
    MSG[Messaging<br/>chat-service]
    MD[Media<br/>media-service]
    NT[Notification<br/>notification-service]

    IAC -- "OHS: User data" --> SG
    IAC -- "OHS: User data" --> CT
    IAC -- "OHS: User data" --> MSG
    IAC -- "OHS: User data" --> NT

    SG -- "OHS: Friend list" --> CT
    SG -- "Event: FriendRequestSent/Accepted" --> NT

    CT -- "Event: PostLiked/Commented/Shared" --> NT

    MSG -- "Event: MessageSent/GroupMemberAdded" --> NT

    MD -- "OHS: Presigned URL" --> IAC
    MD -- "OHS: Presigned URL" --> CT
    MD -- "OHS: Presigned URL" --> MSG
```

**Relationship Table:**

| Upstream | Downstream | Relationship Type | Data Exchanged |
|----------|------------|-------------------|----------------|
| Identity & Access | Social Graph | Open Host Service (OHS) | User ID, display name, avatar URL (REST call) |
| Identity & Access | Content | Open Host Service (OHS) | User ID, display name, avatar URL (REST call) |
| Identity & Access | Messaging | Open Host Service (OHS) | User ID, display name, avatar URL (REST call) |
| Identity & Access | Notification | Open Host Service (OHS) | User ID, display name (REST call) |
| Social Graph | Content | Open Host Service (OHS) | Friend list for feed generation (REST call) |
| Social Graph | Notification | Event-driven (Redis Pub/Sub) | FriendRequestSent, FriendRequestAccepted events |
| Content | Notification | Event-driven (Redis Pub/Sub) | PostLiked, CommentCreated, PostShared events |
| Messaging | Notification | Event-driven (Redis Pub/Sub) | MessageSent, GroupMemberAdded events |
| Media | Identity, Content, Messaging | Open Host Service (OHS) | Presigned URL, media metadata (REST call) |

> **Communication patterns:**
> - **Synchronous (REST)**: Khi downstream cần data ngay lập tức (ví dụ: post-service cần friend list để build feed).
> - **Asynchronous (Redis Pub/Sub)**: Khi upstream phát sinh event mà downstream xử lý bất đồng bộ (ví dụ: notification khi có like mới). Redis Pub/Sub được chọn thay vì Kafka/RabbitMQ vì đã có Redis trong stack và quy mô vừa phải.

### 2.7 Service Composition

**Flow 1: User đăng ký và thiết lập Profile**

```mermaid
sequenceDiagram
    participant Client
    participant Gateway as API Gateway
    participant US as user-service
    participant MS as media-service
    participant DB_PG as PostgreSQL

    Client->>Gateway: POST /api/auth/register
    Gateway->>US: Forward (no auth required)
    US->>DB_PG: INSERT user
    DB_PG-->>US: User created
    US-->>Gateway: 201 {user, tokens}
    Gateway-->>Client: 201 Created

    Note over Client: Later — upload avatar
    Client->>Gateway: POST /api/media/upload (multipart + JWT)
    Gateway->>MS: Forward (JWT validated)
    MS->>MS: Save to MinIO bucket
    MS-->>Gateway: 201 {mediaId, url}
    Gateway-->>Client: 201 Media uploaded

    Client->>Gateway: PUT /api/users/:id (avatarUrl + JWT)
    Gateway->>US: Forward
    US->>DB_PG: UPDATE user profile
    US-->>Gateway: 200 Updated
    Gateway-->>Client: 200 OK
```

**Flow 2: Kết bạn**

```mermaid
sequenceDiagram
    participant A as User A (Client)
    participant GW as API Gateway
    participant FS as friend-service
    participant NS as notification-service
    participant B as User B (Client)

    A->>GW: POST /api/friends/request {toUserId: B}
    GW->>FS: Forward (JWT validated → userId = A)
    FS->>FS: Validate (not self, not existing friend, no pending)
    FS->>FS: CREATE friend_request (status: pending)
    FS->>FS: Publish event → Redis "friend.request.sent"
    FS-->>GW: 201 Friend request sent
    GW-->>A: 201 Created

    NS->>NS: Subscribe Redis "friend.request.sent"
    NS->>NS: CREATE notification for User B
    NS->>B: Socket.IO emit "notification:new"

    Note over B: User B accepts
    B->>GW: PUT /api/friends/requests/:id/accept
    GW->>FS: Forward (JWT validated → userId = B)
    FS->>FS: UPDATE request status = accepted
    FS->>FS: CREATE friendship (A ↔ B)
    FS->>FS: Publish event → Redis "friend.request.accepted"
    FS-->>GW: 200 Accepted
    GW-->>B: 200 OK

    NS->>NS: Subscribe Redis "friend.request.accepted"
    NS->>NS: CREATE notification for User A
    NS->>A: Socket.IO emit "notification:new"
```

**Flow 3: Đăng bài + Tương tác (Like, Comment)**

```mermaid
sequenceDiagram
    participant U as User (Client)
    participant GW as API Gateway
    participant PS as post-service
    participant MS as media-service
    participant FS as friend-service
    participant NS as notification-service
    participant RD as Redis Cache

    Note over U: Step 1 — Upload ảnh trước
    U->>GW: POST /api/media/upload (multipart)
    GW->>MS: Forward
    MS-->>GW: 201 {mediaId, presignedUrl}
    GW-->>U: 201 Media ready

    Note over U: Step 2 — Tạo post
    U->>GW: POST /api/posts {content, mediaIds}
    GW->>PS: Forward
    PS->>PS: Save post to PostgreSQL
    PS->>RD: Invalidate feed cache (friends of author)
    PS-->>GW: 201 Post created
    GW-->>U: 201 Created

    Note over U: Step 3 — Friend xem feed
    U->>GW: GET /api/feed?page=1
    GW->>PS: Forward
    PS->>RD: Check feed cache
    alt Cache HIT
        RD-->>PS: Cached feed data
    else Cache MISS
        PS->>FS: GET /internal/friends/:userId (friend list)
        FS-->>PS: [friendId1, friendId2, ...]
        PS->>PS: Query posts from friends
        PS->>RD: Cache feed (TTL 10 min)
    end
    PS-->>GW: 200 {posts}
    GW-->>U: 200 Feed

    Note over U: Step 4 — Like post
    U->>GW: POST /api/posts/:id/like
    GW->>PS: Forward
    PS->>PS: INSERT like
    PS->>PS: Publish event → Redis "post.liked"
    PS-->>GW: 200 Liked
    GW-->>U: 200 OK

    NS->>NS: Subscribe "post.liked"
    NS->>NS: CREATE notification for post author
    NS-->>NS: Socket.IO push to author
```

**Flow 4: Nhắn tin Realtime (1-1 & Group Chat)**

```mermaid
sequenceDiagram
    participant A as User A
    participant GW as API Gateway
    participant CS as chat-service
    participant NS as notification-service
    participant B as User B

    Note over A,B: WebSocket connection qua Socket.IO
    A->>CS: Socket.IO connect (JWT in handshake)
    CS->>CS: Validate JWT, join user room
    B->>CS: Socket.IO connect (JWT in handshake)

    Note over A: Gửi tin nhắn
    A->>CS: Socket.IO emit "message:send" {conversationId, content}
    CS->>CS: Save message to MongoDB
    CS->>CS: Publish "message:received" to conversation room
    CS->>B: Socket.IO emit "message:received" {message}

    alt User B is offline
        CS->>CS: Publish event → Redis "message.sent"
        NS->>NS: Subscribe "message.sent"
        NS->>NS: CREATE notification for User B
    end

    Note over B: Đánh dấu đã đọc
    B->>CS: Socket.IO emit "message:read" {conversationId, messageId}
    CS->>CS: Update readAt in MongoDB
    CS->>A: Socket.IO emit "message:read" {conversationId, messageId}
```

**Flow 5: Upload ảnh với Presigned URL (Xác thực)**

```mermaid
sequenceDiagram
    participant U as User (Client)
    participant GW as API Gateway
    participant MS as media-service
    participant MIO as MinIO Storage

    Note over U: Step 1 — Upload ảnh
    U->>GW: POST /api/media/upload (multipart/form-data + JWT)
    GW->>GW: Validate JWT
    GW->>MS: Forward file
    MS->>MS: Validate file (type, size <= 10MB)
    MS->>MIO: PutObject (private bucket)
    MIO-->>MS: Object stored
    MS->>MS: Save metadata to DB
    MS-->>GW: 201 {mediaId}
    GW-->>U: 201 Media uploaded

    Note over U: Step 2 — Lấy ảnh (presigned URL)
    U->>GW: GET /api/media/:mediaId/url (JWT required)
    GW->>GW: Validate JWT
    GW->>MS: Forward
    MS->>MS: Verify user has access (owner or friend's post)
    MS->>MIO: GeneratePresignedURL (TTL = 15 min)
    MIO-->>MS: https://minio:9000/bucket/obj?signature=...&expires=...
    MS-->>GW: 200 {presignedUrl, expiresAt}
    GW-->>U: 200 Presigned URL

    Note over U: Step 3 — Tải ảnh trực tiếp
    U->>MIO: GET presigned URL (no auth header needed)
    MIO->>MIO: Verify signature + expiry
    MIO-->>U: 200 Image binary

    Note over U: Sau 15 phút
    U->>MIO: GET expired presigned URL
    MIO-->>U: 403 Forbidden (URL expired)
```

---

### Part 2 Summary — How DDD Steps Map to Service Candidates and API Endpoints

| DDD Step | Intermediate Output | What it contributes to |
|----------|---------------------|------------------------|
| **2.1** Ubiquitous Language | Shared glossary (20 terms) | Consistent naming across all services and APIs |
| **2.2** Domain Events (Event Storming) | 30 domain events | Evidence base for commands and service boundaries |
| **2.3** Commands + Actors | 28 commands with triggering actors | → **API endpoints** (each command ≈ one endpoint) |
| **2.4** Aggregates | 10 aggregates with owned data | → **Service boundaries** (aggregates cluster by context) |
| **2.5** Bounded Contexts | **→ 6 Service Candidates** | Each Bounded Context = one microservice |
| **2.6** Context Map | Upstream/downstream relationships | → Deployment topology and communication patterns |
| **2.7** Service Composition | Inter-service sequence diagrams | → Architecture diagram in `architecture.md` |
| **3.1** Contract Design | **→ API Endpoints** (final output) | OpenAPI specs in `docs/api-specs/` |

---

## Part 3 — Service-Oriented Design

### 3.1 Uniform Contract Design

Service Contract specification for each Bounded Context / service.
Full OpenAPI specs:
- [`docs/api-specs/user-service.yaml`](api-specs/user-service.yaml)
- [`docs/api-specs/friend-service.yaml`](api-specs/friend-service.yaml)
- [`docs/api-specs/post-service.yaml`](api-specs/post-service.yaml)
- [`docs/api-specs/chat-service.yaml`](api-specs/chat-service.yaml)
- [`docs/api-specs/media-service.yaml`](api-specs/media-service.yaml)
- [`docs/api-specs/notification-service.yaml`](api-specs/notification-service.yaml)

---

**user-service — Identity & Access:**

| Endpoint | Method | Description | Request Body | Response Codes |
|----------|--------|-------------|--------------|----------------|
| `/auth/register` | POST | Đăng ký tài khoản | `{email, password, displayName}` | 201, 400, 409 |
| `/auth/login` | POST | Đăng nhập | `{email, password}` | 200, 401 |
| `/auth/refresh` | POST | Refresh access token | `{refreshToken}` | 200, 401 |
| `/auth/logout` | POST | Đăng xuất (blacklist token) | — | 200, 401 |
| `/users/:id` | GET | Lấy profile user | — | 200, 404 |
| `/users/:id` | PUT | Cập nhật profile | `{displayName?, bio?, avatarUrl?}` | 200, 400, 403 |
| `/users/search` | GET | Tìm kiếm user | `?q=keyword&page=1&limit=20` | 200 |
| `/users/batch` | POST | Lấy nhiều users (internal) | `{userIds: [...]}` | 200 |

---

**friend-service — Social Graph:**

| Endpoint | Method | Description | Request Body | Response Codes |
|----------|--------|-------------|--------------|----------------|
| `/friends/request` | POST | Gửi lời mời kết bạn | `{toUserId}` | 201, 400, 409 |
| `/friends/requests` | GET | Danh sách lời mời pending | `?type=received\|sent&page&limit` | 200 |
| `/friends/requests/:id/accept` | PUT | Chấp nhận lời mời | — | 200, 404, 403 |
| `/friends/requests/:id/reject` | PUT | Từ chối lời mời | — | 200, 404, 403 |
| `/friends` | GET | Danh sách bạn bè | `?page&limit` | 200 |
| `/friends/:friendId` | DELETE | Hủy kết bạn | — | 200, 404 |
| `/friends/mutual/:userId` | GET | Bạn chung với user khác | — | 200 |
| `/friends/suggestions` | GET | Gợi ý kết bạn | `?limit=10` | 200 |
| `/friends/check/:userId` | GET | Kiểm tra trạng thái bạn bè | — | 200 |
| `/internal/friends/:userId` | GET | Friend IDs (internal only) | — | 200 |

---

**post-service — Content:**

| Endpoint | Method | Description | Request Body | Response Codes |
|----------|--------|-------------|--------------|----------------|
| `/posts` | POST | Tạo bài đăng | `{content, mediaIds?, visibility?}` | 201, 400 |
| `/posts/:id` | GET | Xem bài đăng | — | 200, 404 |
| `/posts/:id` | PUT | Sửa bài đăng | `{content?, mediaIds?}` | 200, 403, 404 |
| `/posts/:id` | DELETE | Xóa bài đăng | — | 200, 403, 404 |
| `/posts/user/:userId` | GET | Bài đăng của user | `?page&limit` | 200 |
| `/feed` | GET | News feed | `?page&limit&cursor` | 200 |
| `/posts/:id/like` | POST | Like bài đăng | — | 200, 404 |
| `/posts/:id/like` | DELETE | Unlike bài đăng | — | 200, 404 |
| `/posts/:id/comments` | GET | Lấy comments | `?page&limit` | 200 |
| `/posts/:id/comments` | POST | Tạo comment | `{content}` | 201, 400 |
| `/posts/:postId/comments/:commentId` | DELETE | Xóa comment | — | 200, 403, 404 |
| `/posts/:id/share` | POST | Chia sẻ bài đăng | `{content?}` | 201, 404 |

---

**chat-service — Messaging:**

| Endpoint | Method | Description | Request Body | Response Codes |
|----------|--------|-------------|--------------|----------------|
| `/conversations` | GET | Danh sách conversations | `?page&limit` | 200 |
| `/conversations` | POST | Tạo conversation 1-1 | `{participantId}` | 201, 400, 409 |
| `/conversations/:id/messages` | GET | Lịch sử tin nhắn | `?before&limit` (cursor-based) | 200, 403 |
| `/groups` | POST | Tạo nhóm chat | `{name, memberIds}` | 201, 400 |
| `/groups/:id` | GET | Thông tin nhóm | — | 200, 404 |
| `/groups/:id` | PUT | Sửa thông tin nhóm | `{name?, avatarUrl?}` | 200, 403 |
| `/groups/:id/members` | POST | Thêm thành viên | `{userId}` | 200, 403 |
| `/groups/:id/members/:userId` | DELETE | Xóa thành viên | — | 200, 403 |
| `/groups/:id/leave` | POST | Rời nhóm | — | 200 |

**Socket.IO Events (Realtime):**

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `message:send` | Client → Server | `{conversationId, content, type?}` | Gửi tin nhắn |
| `message:received` | Server → Client | `{message}` | Nhận tin nhắn mới |
| `message:read` | Client → Server | `{conversationId, messageId}` | Đánh dấu đã đọc |
| `message:read:ack` | Server → Client | `{conversationId, messageId, readBy}` | Xác nhận đã đọc |
| `typing:start` | Client → Server | `{conversationId}` | Đang gõ |
| `typing:stop` | Client → Server | `{conversationId}` | Ngừng gõ |
| `typing:indicator` | Server → Client | `{conversationId, userId}` | Hiển thị typing |
| `user:online` | Server → Client | `{userId}` | User online |
| `user:offline` | Server → Client | `{userId}` | User offline |

---

**media-service — Media:**

| Endpoint | Method | Description | Request Body | Response Codes |
|----------|--------|-------------|--------------|----------------|
| `/media/upload` | POST | Upload file (multipart) | `file` (form-data) | 201, 400, 413 |
| `/media/:id` | GET | Lấy metadata | — | 200, 404 |
| `/media/:id/url` | GET | Lấy presigned URL | — | 200, 403, 404 |
| `/media/:id` | DELETE | Xóa media | — | 200, 403, 404 |
| `/media/batch-urls` | POST | Batch presigned URLs | `{mediaIds: [...]}` | 200 |

> **Presigned URL Security Flow:**
> 1. Tất cả requests qua Gateway → **JWT required**
> 2. media-service verify quyền truy cập (owner hoặc có quyền xem)
> 3. Generate presigned URL từ MinIO với **TTL 15 phút**
> 4. Client dùng presigned URL tải ảnh trực tiếp từ MinIO
> 5. Sau TTL → URL hết hạn → `403 Forbidden`

---

**notification-service — Notification:**

| Endpoint | Method | Description | Request Body | Response Codes |
|----------|--------|-------------|--------------|----------------|
| `/notifications` | GET | Danh sách thông báo | `?page&limit&unreadOnly` | 200 |
| `/notifications/unread-count` | GET | Số thông báo chưa đọc | — | 200 |
| `/notifications/:id/read` | PUT | Đánh dấu 1 thông báo đã đọc | — | 200, 404 |
| `/notifications/read-all` | PUT | Đánh dấu tất cả đã đọc | — | 200 |

**Redis Pub/Sub Events (Consumed):**

| Channel | Source Service | Notification Type | Message to User |
|---------|---------------|-------------------|-----------------|
| `friend.request.sent` | friend-service | `friend_request` | "{User A} đã gửi lời mời kết bạn" |
| `friend.request.accepted` | friend-service | `friend_accepted` | "{User A} đã chấp nhận lời mời kết bạn" |
| `post.liked` | post-service | `post_liked` | "{User A} đã thích bài viết của bạn" |
| `post.commented` | post-service | `post_commented` | "{User A} đã bình luận bài viết của bạn" |
| `post.shared` | post-service | `post_shared` | "{User A} đã chia sẻ bài viết của bạn" |
| `message.sent` | chat-service | `new_message` | "{User A} đã gửi tin nhắn cho bạn" |
| `group.member.added` | chat-service | `group_added` | "Bạn đã được thêm vào nhóm {Group Name}" |

**Socket.IO Events (Pushed):**

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `notification:new` | Server → Client | `{notification}` | Push thông báo mới realtime |
| `notification:count` | Server → Client | `{unreadCount}` | Cập nhật số chưa đọc |

---

### 3.2 Service Logic Design

**user-service — RegisterUser:**

```mermaid
flowchart TD
    A[Receive POST /auth/register] --> B{Validate input?}
    B -->|Invalid| C[Return 400 Bad Request]
    B -->|Valid| D{Email already exists?}
    D -->|Yes| E[Return 409 Conflict]
    D -->|No| F[Hash password with bcrypt]
    F --> G[INSERT user to PostgreSQL]
    G --> H[Generate JWT access + refresh tokens]
    H --> I[Return 201 with user + tokens]
```

**friend-service — SendFriendRequest:**

```mermaid
flowchart TD
    A[Receive POST /friends/request] --> B{Validate JWT?}
    B -->|Invalid| C[Return 401 Unauthorized]
    B -->|Valid| D{toUserId == self?}
    D -->|Yes| E[Return 400 Cannot add self]
    D -->|No| F{Already friends?}
    F -->|Yes| G[Return 409 Already friends]
    F -->|No| H{Pending request exists?}
    H -->|Yes| I[Return 409 Request pending]
    H -->|No| J[INSERT friend_request status=pending]
    J --> K[Publish Redis event 'friend.request.sent']
    K --> L[Return 201 Request sent]
```

**post-service — CreatePost:**

```mermaid
flowchart TD
    A[Receive POST /posts] --> B{Validate JWT?}
    B -->|Invalid| C[Return 401 Unauthorized]
    B -->|Valid| D{Content or mediaIds provided?}
    D -->|Neither| E[Return 400 Post cannot be empty]
    D -->|Yes| F{MediaIds valid? call media-service}
    F -->|Invalid| G[Return 400 Invalid media]
    F -->|Valid| H[INSERT post to PostgreSQL]
    H --> I[Invalidate author's friends feed cache in Redis]
    I --> J[Return 201 Post created]
```

**chat-service — SendMessage (Socket.IO):**

```mermaid
flowchart TD
    A["Receive Socket.IO 'message:send'"] --> B{JWT valid in socket handshake?}
    B -->|Invalid| C[Emit error, disconnect]
    B -->|Valid| D{User is participant in conversation?}
    D -->|No| E[Emit error 'not a participant']
    D -->|Yes| F[INSERT message to MongoDB]
    F --> G["Emit 'message:received' to conversation room"]
    G --> H{Recipient online?}
    H -->|Yes| I[Delivered via Socket.IO]
    H -->|No| J["Publish Redis 'message.sent' for notification"]
```

**media-service — UploadMedia:**

```mermaid
flowchart TD
    A[Receive POST /media/upload multipart] --> B{Validate JWT?}
    B -->|Invalid| C[Return 401 Unauthorized]
    B -->|Valid| D{File type allowed? jpg/png/gif/webp}
    D -->|No| E[Return 400 Invalid file type]
    D -->|Yes| F{File size <= 10MB?}
    F -->|No| G[Return 413 File too large]
    F -->|Yes| H[Generate unique filename UUID]
    H --> I[Upload to MinIO private bucket]
    I --> J[Save metadata to DB - id, originalName, mimeType, size, uploadedBy]
    J --> K[Return 201 with mediaId]
```

**notification-service — Event Handler:**

```mermaid
flowchart TD
    A[Receive Redis Pub/Sub event] --> B{Parse event type}
    B -->|friend.request.sent| C[Create notification type=friend_request]
    B -->|post.liked| D[Create notification type=post_liked]
    B -->|message.sent| E[Create notification type=new_message]
    B -->|...other events| F[Create notification with matching type]

    C --> G[Save notification to MongoDB]
    D --> G
    E --> G
    F --> G

    G --> H{Recipient connected via Socket.IO?}
    H -->|Yes| I["Emit 'notification:new' to user room"]
    I --> J["Emit 'notification:count' with updated unread count"]
    H -->|No| K[Notification stored, user will see on next load]
```
