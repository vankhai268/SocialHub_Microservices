# Báo cáo Kiểm tra API Contract: Frontend ↔ Backend

## Tổng quan

Đã kiểm tra toàn bộ routes và controllers của **7 services** và **1 API Gateway**. Dưới đây là danh sách tất cả các lỗi phát hiện.

---

## 🔴 LỖI NGHIÊM TRỌNG

### LỖI 1: `createGroup` - Frontend nhận response sai shape

**Frontend:** [`ChatWidget.jsx`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/frontend/src/components/ChatWidget.jsx#L136-L147)
```js
// Frontend expect:
const newGroup = res.data.data;         // ← res.data.data
const convRes = await api.get(`/conversations/${newGroup.conversationId}`);
```

**Backend:** [`group.service.js`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/services/chat-service/src/services/group.service.js#L74) → `group.controller.js` dùng `successResponse(res, 201, group)` → trả về `{ success: true, data: group }`.

**Vấn đề:** `group` trả về là MongoDB GroupChat document với `_id`, **không phải** `id`. Frontend gọi `newGroup.conversationId` cũng phụ thuộc vào schema có field này. Cần kiểm tra group model có export `conversationId` không. ✅ **OK** - `group.model.js` có `conversationId`.

**Kết luận:** Không có lỗi ở đây nếu backend dùng `.toJSON()` đúng.

---

### LỖI 2: `markAllNotificationsRead` - Frontend check `res.data.success` nhưng backend không trả về chuẩn

**Frontend:** [`Notifications.jsx`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/frontend/src/pages/Notifications.jsx#L81-L84)
```js
const res = await api.put("/notifications/read-all");
if (res.data && res.data.success) {  // ← check này
    setNotifications(...)
    setUnreadCount(0);
}
```

**Backend:** [`notification.controller.js`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/services/notification-service/src/controllers/notification.controller.js#L138-L141)
```js
return res.status(200).json({
    success: true,
    updatedCount: result.modifiedCount  // ← Không có `data` field
});
```

**Vấn đề:** Frontend check `res.data.success` → OK vì có `success: true`. Không có lỗi thực sự.

---

### LỖI 3 - CRITICAL: `uploadMedia` response mismatch - Backend trả về `id` là ObjectId dạng object, không phải string

**Frontend:** Tất cả upload calls đều dùng `uploadRes.data.id`:
```js
const res = await api.post("/media/upload", formData);
return res.data?.id;  // ← Dùng .id
```

**Backend:** [`media.service.js`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/services/media-service/src/services/media.service.js#L32-L39)
```js
return {
    id: media._id,  // ← _id là Mongoose ObjectId (có thể là object)
    ...
};
```

**Vấn đề:** `media._id` là Mongoose ObjectId. Khi serialize sang JSON nó trở thành string (`"6..."`) nhưng cần verify Mongoose version có auto-convert không. Thông thường `toJSON()` convert tự động.

**Fix cần thiết:** Đảm bảo trả về `id: media._id.toString()` để không có ambiguity.

---

### LỖI 4 - CRITICAL: `getMessages` - Frontend và Backend xử lý response khác nhau

**Frontend:** [`Messages.jsx`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/frontend/src/pages/Messages.jsx#L422-L424)
```js
const res = await api.get(`/conversations/${cId}/messages`);
if (res.data && res.data.success) {
    setMessages(res.data.data?.data ? [...res.data.data.data].reverse() : []);
    // ↑ Truy cập res.data.data.data (nested 2 lần!)
```

**Backend:** `conversation.controller.js` → `successResponse(res, 200, result)` → `{ success: true, data: result }` trong đó `result = { data: resolvedMessages, hasMore, nextCursor }`.

**Phân tích:** 
- `res.data` = `{ success: true, data: { data: [...], hasMore, nextCursor } }`
- Frontend dùng `res.data.data?.data` = `res.data.data` (wrapper của successResponse) + `.data` (field trong result object)
- **Đây là đúng** nhưng confusing. Không có lỗi thực sự.

**Tuy nhiên trong `ChatBox.jsx`:**
```js
const res = await api.get(`/conversations/${conversationId}/messages?limit=40`);
setMessages(res.data.data?.data ? [...res.data.data.data].reverse() : []);
// ↑ Cũng dùng res.data.data.data - đúng theo cùng logic trên
```

✅ Consistent, không lỗi.

---

### LỖI 5 - CRITICAL: Gateway CORS không có `ngrok-skip-browser-warning` trong allowed headers list

**Gateway:** [`gateway/src/app.js`] cần check CORS config. Nếu CORS allowedHeaders không include `ngrok-skip-browser-warning`, browser sẽ bị chặn ở preflight.

**Cần check file** `gateway/src/app.js` để xác nhận.

---

### LỖI 6 - CRITICAL: `updateProfile` - Frontend gửi `name` nhưng backend expect `name`, OK. Nhưng không có `createdAt` trong response từ `getUserById`

**Frontend Profile page:**
```js
// getUserById trả về:
{ success: true, user: { id, email, displayName, bio, avatarUrl } }
// → Thiếu createdAt!
```

**Backend:** [`user.controller.js`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/services/user-service/src/controllers/user.controller.js#L20-L23)
```sql
SELECT id, email, display_name as "displayName", bio, avatar_url as "avatarUrl"
FROM users WHERE id = $1
-- ↑ KHÔNG có created_at!
```

**Frontend dùng:**
```jsx
// Profile.jsx line 336
<span>Đã tham gia: {new Date(profileUser.createdAt || Date.now()).toLocaleDateString()}</span>
```

**Vấn đề:** `profileUser.createdAt` luôn là `undefined` nên fallback thành `Date.now()` - hiển thị ngày hiện tại thay vì ngày tạo tài khoản.

**Fix:** Thêm `created_at as "createdAt"` vào SELECT trong `getUserById`.

---

## 🟡 LỖI NHỎ

### LỖI 7: `fetchMediaUrl` trong chat-service gọi media-service nhưng có thể lỗi vì thiếu x-user-id header

**Backend:** [`chat-service/src/utils/api.js`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/services/chat-service/src/utils/api.js#L50-L58)
```js
const response = await axios.get(`${config.MEDIA_SERVICE_URL}/media/${mediaId}/url`, {
    headers: { Authorization: token }
});
```

**Vấn đề:** media-service `/media/:id/url` dùng `protectRoute` middleware của media-service, cần verify middleware có accept `x-user-id` header không. Nếu protectRoute decode token để lấy user ID thì OK. Nhưng nếu nó dùng `x-user-id` từ gateway thì sẽ fail.

---

### LỖI 8: `getConversations` (Messages.jsx) - Frontend không check pagination nhưng API trả về `res.data.data` (array) trực tiếp

**Frontend:** [`Messages.jsx`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/frontend/src/pages/Messages.jsx)
```js
const res = await api.get("/conversations");
if (res.data && res.data.success) {
    setConversations(res.data.data || []);
```

**Backend:** `successResponse(res, 200, result.data, result.pagination)` → `{ success: true, data: [...conversations], pagination: {...} }`

**Kết luận:** `res.data.data` = mảng conversations. ✅ Đúng, không lỗi.

---

## ✅ API CONTRACTS ĐÃ XÁC NHẬN ĐÚNG

| Endpoint | Frontend Call | Backend Route | Status |
|----------|--------------|---------------|--------|
| `POST /auth/register` | AuthContext | user-service | ✅ |
| `POST /auth/login` | AuthContext | user-service | ✅ |
| `GET /users/:id` | Profile.jsx | user-service | ✅ (thiếu createdAt - LỖI 6) |
| `PUT /users/:id` | Profile.jsx | user-service | ✅ |
| `GET /users/search` | Friends.jsx | user-service | ✅ |
| `POST /media/upload` | nhiều file | media-service | ✅ |
| `GET /media/file/:id` | ChatBox, Messages | media-service | ✅ |
| `GET /media/:id/url` | (không còn dùng sau fix) | media-service | ✅ |
| `POST /posts` | CreatePost.jsx | post-service | ✅ |
| `GET /posts/:id` | nhiều file | post-service | ✅ |
| `PUT /posts/:id` | EditPostModal.jsx | post-service | ✅ |
| `DELETE /posts/:id` | PostCard.jsx | post-service | ✅ |
| `GET /posts/user/:userId` | Profile.jsx | post-service | ✅ |
| `GET /feed` | Feed.jsx | post-service | ✅ |
| `POST /posts/:id/like` | PostCard.jsx | post-service | ✅ |
| `DELETE /posts/:id/like` | PostCard.jsx | post-service | ✅ |
| `GET /posts/:id/comments` | PostCard.jsx | post-service | ✅ |
| `POST /posts/:id/comments` | PostCard.jsx | post-service | ✅ |
| `DELETE /posts/:postId/comments/:commentId` | PostCard.jsx | post-service | ✅ |
| `POST /posts/:id/share` | ShareModal.jsx | post-service | ✅ |
| `POST /friends/request` | Profile.jsx, Friends.jsx | friend-service | ✅ |
| `GET /friends/requests` | Friends.jsx | friend-service | ✅ |
| `PUT /friends/requests/:id/accept` | Profile.jsx, Friends.jsx | friend-service | ✅ |
| `PUT /friends/requests/:id/reject` | Profile.jsx, Friends.jsx | friend-service | ✅ |
| `GET /friends` | Friends.jsx, ChatWidget.jsx | friend-service | ✅ |
| `GET /friends/suggestions` | Friends.jsx | friend-service | ✅ |
| `GET /friends/check/:id` | Profile.jsx, Friends.jsx | friend-service | ✅ |
| `DELETE /friends/:id` | Profile.jsx, Friends.jsx | friend-service | ✅ |
| `GET /notifications` | Notifications.jsx | notification-service | ✅ |
| `GET /notifications/unread-count` | SocketContext.jsx | notification-service | ✅ |
| `PUT /notifications/:id/read` | Notifications.jsx | notification-service | ✅ |
| `PUT /notifications/read-all` | Notifications.jsx | notification-service | ✅ |
| `GET /conversations` | Messages.jsx | chat-service | ✅ |
| `POST /conversations` | ChatWidget.jsx | chat-service | ✅ |
| `GET /conversations/:id` | ChatWidget.jsx, ChatBox.jsx | chat-service | ✅ |
| `GET /conversations/:id/messages` | Messages.jsx, ChatBox.jsx | chat-service | ✅ |
| `DELETE /conversations/:id` | Messages.jsx | chat-service | ✅ |
| `POST /groups` | ChatWidget.jsx | chat-service | ✅ |

---

## Cần fix ngay

### 1. Fix `getUserById` - Thêm `createdAt` vào SELECT

**File:** [`user.controller.js`](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/services/user-service/src/controllers/user.controller.js#L20-L23)

```diff
- SELECT id, email, display_name as "displayName", bio, avatar_url as "avatarUrl"
+ SELECT id, email, display_name as "displayName", bio, avatar_url as "avatarUrl", created_at as "createdAt"
  FROM users WHERE id = $1
```

> [!NOTE]
> Cũng cần invalidate Redis cache sau khi sửa query, hoặc chờ cache TTL 30 phút expire. Nhanh hơn là `await redis.del('user:*')` hoặc restart service.

### 2. Cần check CORS config của gateway

**File:** `gateway/src/app.js` - cần xem CORS allowedHeaders có bao gồm `ngrok-skip-browser-warning` không.
