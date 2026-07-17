# Hướng dẫn Thiết lập Coturn Server (STUN/TURN) bằng Docker

Tài liệu này hướng dẫn bạn chi tiết cách thiết lập máy chủ STUN/TURN bằng hai phương pháp tối ưu nhất hiện nay: **Cách 2: Sử dụng dịch vụ đám mây miễn phí của Metered.ca**.

---

## PHƯƠNG ÁN B: Sử dụng dịch vụ TURN Server của Metered.ca (Free 50GB/Tháng)

Nếu bạn không muốn thiết lập máy chủ và quản lý cổng mạng phức tạp, bạn có thể sử dụng dịch vụ đám mây miễn phí chất lượng cao của **Metered.ca**.

### 1. Đăng ký tài khoản
1. Truy cập trang web: [https://www.metered.ca/](https://www.metered.ca/)
2. Đăng ký một tài khoản miễn phí (chọn gói **Free Tier** có sẵn 50 GB băng thông hàng tháng - rất thoải mái cho môi trường phát triển và thử nghiệm).
3. Đăng nhập vào Dashboard của Metered.

### 2. Lấy thông tin cấu hình
1. Tại Dashboard, click vào **App Settings** hoặc **WebRTC TURN Servers**.
2. Click **Create Application** (nếu chưa có).
3. Hệ thống sẽ hiển thị một danh sách các máy chủ ICE bao gồm cả STUN và TURN với thông tin đăng nhập tự động. Nó sẽ trông tương tự như sau:
   - **STUN**: `stun:global.turn.metered.ca:80`
   - **TURN (UDP)**: `turn:global.turn.metered.ca:8678` (hoặc cổng 443)
   - **Username**: `được tạo tự động`
   - **Password (Credential)**: `được tạo tự động`

---

## Tích hợp cấu hình vào Source Code Frontend

Mở file [CallWindow.jsx](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/frontend/src/components/CallWindow.jsx) trong source code frontend của bạn và thay thế biến `ICE_SERVERS` tương ứng với phương án bạn chọn:

### Cấu hình cho máy chủ tự host Oracle Cloud (Phương án A):
```javascript
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        // Cấu hình máy chủ Coturn tự host trên Oracle Cloud:
        {
            urls: "turn:turn.socialhubzz.cloud:3478",
            username: "socialhub_user",
            credential: "socialhub_secret_pass"
        }
    ]
};
```

### Cấu hình cho dịch vụ Metered.ca (Phương án B):
```javascript
const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:global.turn.metered.ca:80" },
        {
            urls: "turn:global.turn.metered.ca:8678?transport=udp",
            username: "dien_username_tu_metered_vao_day",
            credential: "dien_password_tu_metered_vao_day"
        },
        {
            urls: "turn:global.turn.metered.ca:443?transport=tcp",
            username: "dien_username_tu_metered_vao_day",
            credential: "dien_password_tu_metered_vao_day"
        }
    ]
};
```

---

## Cách kiểm tra (Test) xem TURN có chạy được hay không
1. Mở trang WebRTC test: [Trickle ICE Tool](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
2. Nhập thông tin TURN Server của bạn vào biểu mẫu trên trang web.
3. Bấm **Add Server** -> **Gather candidates**.
4. Kiểm tra cột **Type** ở bảng kết quả: Nếu xuất hiện bản ghi có type là **`relay`**, chúc mừng bạn, TURN Server của bạn đang hoạt động cực kỳ hoàn hảo!
