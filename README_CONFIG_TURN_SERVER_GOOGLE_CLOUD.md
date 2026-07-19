# Hướng dẫn Thiết lập Coturn Server (STUN/TURN) trên Google Cloud Platform & Cloudflare

Tài liệu này hướng dẫn chi tiết cách tự host một máy chủ STUN/TURN (Coturn) trên Google Cloud Platform (GCP) Compute Engine để phục vụ tính năng gọi Video và Voice call cho dự án **SocialHub Microservices** đang chạy trên cụm GKE. Đồng thời hướng dẫn cách cấu hình Cloudflare miễn phí mà không cần trả phí cho lưu lượng UDP.

---

## ☁️ 1. Giải đáp thắc mắc: Cloudflare và Gói dịch vụ hỗ trợ UDP

> [!IMPORTANT]
> **KHÔNG CẦN mua gói trả phí nào của Cloudflare để chạy UDP cho TURN Server!**
> - Mặc định, tính năng Proxy của Cloudflare (đám mây màu cam 🟠) chỉ hỗ trợ HTTP/HTTPS. Để chuyển tiếp UDP/TCP tùy ý qua mạng proxy của họ, Cloudflare yêu cầu dịch vụ **Cloudflare Spectrum** (chỉ có trên gói Enterprise hoặc các gói trả phí đắt đỏ).
> - **Tuy nhiên, đối với WebRTC (Video/Voice Call)**: Các trình duyệt của người dùng (WebRTC Client) cần kết nối trực tiếp đến IP của TURN Server bằng giao thức UDP/TCP nguyên bản để truyền tải hình ảnh/âm thanh mà không qua bất kỳ proxy trung gian nào (tránh làm tăng độ trễ cuộc gọi).
> - **Giải pháp tối ưu và miễn phí**: Ta chỉ cấu hình bản ghi DNS của TURN Server trên Cloudflare ở trạng thái **DNS Only (Đám mây màu xám 🔘)**. 
>   * Khi đó, Cloudflare chỉ đóng vai trò phân giải tên miền (ví dụ: `turn.yourdomain.com` -> IP của VM).
>   * Các gói tin UDP của cuộc gọi sẽ đi thẳng từ trình duyệt của người dùng tới VM trên Google Cloud.
>   * Việc này **hoàn toàn miễn phí 100%** và là cách thiết lập tiêu chuẩn cho tất cả các hệ thống WebRTC trên thế giới.

---

## 📐 2. Mô hình Kiến trúc Kết nối

```mermaid
flowchart TD
    subgraph Client ["Client Browser (WebRTC)"]
        A[Frontend Web App]
    end

    subgraph Cloudflare ["Cloudflare DNS Only"]
        B["turn.yourdomain.com (A Record - Gray Cloud)"]
    end

    subgraph GCP ["Google Cloud Platform (GCP)"]
        subgraph GKE ["GKE Cluster (SocialHub App)"]
            C[Frontend Service]
            D[Gateway / Backend Services]
        end
        subgraph GCE ["Compute Engine (Coturn VM)"]
            E[Docker: Coturn Container]
        end
    end

    A -->|1. Đăng nhập / Bắt đầu gọi| C
    A -.->|2. Hỏi DNS IP của TURN| B
    B -.->|Trỏ về IP của GCE VM| A
    A -->|3. Kết nối STUN/TURN (UDP port 3478)| E
    A -->|4. Truyền tải Media (UDP ports 49152-49200)| E
    E -->|Relay Media tới Peer khác| Client
```

---

## 🛠️ 3. Các Bước Thiết Lập Coturn Trên Google Cloud Platform (GCP)

### Bước 3.1: Tạo Máy ảo Compute Engine (GCE VM)
1. Đăng nhập vào [Google Cloud Console](https://console.cloud.google.com/).
2. Chọn dự án của bạn và tìm đến mục **Compute Engine** -> **VM instances**.
3. Nhấp vào **Create Instance** (Tạo máy ảo):
   - **Name**: `socialhub-coturn-vm`
   - **Region & Zone**: Chọn khu vực gần người dùng của bạn nhất (ví dụ: `asia-east1` - Đài Loan hoặc `asia-southeast1` - Singapore).
   - **Machine configuration**:
     - **Series**: `E2`
     - **Machine type**: `e2-micro` (2 vCPU, 1 GB RAM). 
       > [!TIP]
       > Cấu hình `e2-micro` cực kỳ rẻ (~$7-8/tháng) hoặc miễn phí nếu tài khoản của bạn nằm trong chương trình GCP Free Tier. Coturn được viết bằng C/C++ nên cực kỳ nhẹ, chỉ tiêu tốn khoảng 30MB-50MB RAM và 1-5% CPU cho các cuộc gọi thông thường.
   - **Boot disk**:
     - **Operating system**: `Ubuntu`
     - **Version**: `Ubuntu 22.04 LTS` hoặc `Ubuntu 24.04 LTS` (x86/64).
   - **Firewall**: Để trống (Chúng ta sẽ cấu hình Firewall ở mức VPC Network bên dưới).
4. Nhấp **Create** để khởi tạo máy ảo.

---

### Bước 3.2: Cấu hình Địa chỉ IP Tĩnh (Static External IP)
Trong ảnh chụp màn hình của bạn, dòng `socialhub-coturn-vm` đang hiển thị **Access type: Internal** (IP nội bộ). Để TURN Server chạy được từ internet, máy ảo bắt buộc phải có một địa chỉ **IP ngoại vi tĩnh (Static External IP)**. 

Bạn hãy làm theo một trong hai cách dưới đây tùy thuộc vào trạng thái VM của bạn:

#### Cách A: Nếu máy ảo đã được cấp IP ngoại vi (Ephemeral) lúc tạo
1. Trên GCP Console, truy cập **VPC Network** -> **IP addresses**.
2. Tìm địa chỉ IP ngoại vi (cột **Access type** là `External`, cột **Type** là `Ephemeral`) có cột **In use by** hiển thị tên máy ảo `socialhub-coturn-vm`.
3. Nhấp vào biểu tượng **3 dấu chấm đứng** ở cuối dòng đó (cột Actions) -> Chọn **Promote to static IP address** (hoặc Chuyển thành IP tĩnh).
4. Đặt tên gợi nhớ (ví dụ: `socialhub-coturn-static-ip`) và xác nhận lưu.

#### Cách B: Tạo mới một IP tĩnh ngoại vi và gắn trực tiếp vào VM (KHUYÊN DÙNG)
1. Tại trang **IP addresses** (như trong ảnh của bạn), nhấp vào nút **Reserve static address** (hoặc **Reserve external static IP address** - nút này nằm ở trên cùng, bên cạnh nút *Reserve internal* nhưng có thể bị khuất hoặc nằm ở đầu thanh công cụ tùy giao diện).
2. Điền thông tin vào biểu mẫu:
   - **Name**: `socialhub-coturn-static-ip`
   - **Network Service Tier**: `Premium` (mặc định)
   - **IP version**: `IPv4`
   - **Type**: `Regional`
   - **Region**: Chọn **`asia-east1`** (Bắt buộc phải chọn đúng vùng `asia-east1` giống như vùng của máy ảo hiển thị ở dòng số 3 trong ảnh của bạn).
   - **Attached to**: Nhấp chọn và tìm trong danh sách tên máy ảo của bạn: **`socialhub-coturn-vm`**.
3. Nhấp nút **Reserve** ở góc dưới. 
4. Hệ thống sẽ tạo ra một địa chỉ IP tĩnh ngoại vi mới và tự động gắn (attach) vào máy ảo của bạn. Bạn hãy copy địa chỉ IP này để cấu hình DNS trên Cloudflare sau này.

> [!WARNING]
> **XỬ LÝ LỖI "Constraint constraints/compute.vmExternalIpAccess violated"**:
> Mặc định trong các tài khoản/tổ chức GCP, Google Cloud áp dụng một chính sách bảo mật để chặn các máy ảo Compute Engine sử dụng IP ngoại vi (External IP) nhằm tránh nguy cơ bảo mật. Khi gặp lỗi này, bạn cần cấu hình lại chính sách **Organization Policy** của dự án:
> 
> **Cách xử lý trực tiếp trên GCP Web Console:**
> 1. Trên thanh tìm kiếm của GCP Console, tìm và chọn **IAM & Admin** -> **Organization Policies** (Chính sách tổ chức).
> 2. Tìm kiếm chính sách có tên: **`Define allowed external IPs for VM instances`** (hoặc lọc theo ID: `constraints/compute.vmExternalIpAccess`).
> 3. Click vào chính sách đó -> Nhấp vào nút **Manage Policy** (Quản lý chính sách) hoặc **Edit**.
> 4. Ở phần **Applies to**, chọn **Customize** (Tùy chỉnh) để ghi đè cài đặt mặc định của dự án.
> 5. Tại phần **Rules**:
>    - Nhấp chọn **Allow all** (Cho phép tất cả) để tắt chính sách chặn IP ngoại vi cho toàn bộ dự án này (Khuyên dùng cho môi trường Dev/Test để dễ tạo các dịch vụ khác sau này).
>    - *Hoặc (Nếu muốn bảo mật tối đa)*: Chọn **Allowed** (Cho phép) -> Nhấp **Add value** và nhập đúng đường dẫn tài nguyên máy ảo của bạn: `projects/socialhub-micro-service-1/zones/asia-east1-c/instances/socialhub-coturn-vm` (như trong thông báo lỗi của bạn).
> 6. Nhấn **Save** (Lưu) và đợi khoảng 1 phút để hệ thống cập nhật.
> 7. Quay lại trang **IP addresses** và nhấp **Reserve** lại là sẽ thành công 100%!

---

### Bước 3.3: Mở cổng trên GCP VPC Firewall Rules
Bạn phải cho phép lưu lượng truy cập đi qua tường lửa của Google Cloud vào máy ảo:
1. Vào **VPC Network** -> **Firewall**.
2. Nhấp vào **Create Firewall Rule** (Tạo quy tắc tường lửa):
   - **Name**: `allow-coturn-media-relay`
   - **Network**: `default`
   - **Priority**: `1000`
   - **Direction of traffic**: `Ingress` (Lưu lượng đi vào)
   - **Action on match**: `Allow`
   - **Targets**: `All instances in the network` (Hoặc chọn `Specified target tags` và thêm tag `coturn-server` vào VM của bạn).
   - **Source filter**: `IPv4 ranges`
   - **Source IPv4 ranges**: `0.0.0.0/0` (Cho phép mọi địa chỉ IP kết nối)
   - **Protocols and ports**:
     - Chọn **Specified protocols and ports**.
     - Tích chọn **TCP**: Nhập `3478` (Cổng chính của STUN/TURN).
     - Tích chọn **UDP**: Nhập `3478,49152-49200` (Cổng chính STUN/TURN và dải cổng dùng để truyền tải Media Relay).
3. Nhấp **Create** để áp dụng quy tắc.

---

### Bước 3.4: Cài đặt và cấu hình Coturn bên trong VM
1. Tại danh sách VM instances, nhấp vào nút **SSH** bên cạnh máy ảo `socialhub-coturn-vm` để kết nối vào terminal của máy ảo.
2. Cập nhật hệ thống và cài đặt Docker:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io
   sudo systemctl start docker
   sudo systemctl enable docker
   ```
3. Tạo thư mục chứa file cấu hình Coturn:
   ```bash
   sudo mkdir -p /opt/coturn
   ```
4. Tạo và chỉnh sửa file cấu hình `turnserver.conf`:
   ```bash
   sudo nano /opt/coturn/turnserver.conf
   ```
5. Dán nội dung sau vào file cấu hình (thay đổi thông tin tên miền và tài khoản theo ý muốn):
   ```ini
   # Cổng lắng nghe chính cho STUN/TURN
   listening-port=3478

   # Cơ chế bảo mật và xác thực
   fingerprint
   lt-cred-mech

   # Tên miền của bạn (Realm)
   realm=turn.yourdomain.com

   # Tài khoản kết nối (Định dạng: username:password)
   # Bạn có thể tạo nhiều dòng user nếu muốn cấp cho nhiều client khác nhau
   user=social...:socia..._pass

   # Giới hạn dải cổng truyền tải Media (Trùng khớp với cổng đã mở trên GCP Firewall)
   min-port=49152
   max-port=49200

   # Cấu hình NAT (Bắt buộc đối với GCP VM vì VM chạy sau 1-to-1 NAT)
   # Định dạng: external-ip=<IP_EXTERNAL_TĨNH_VM_GCP>/<IP_INTERNAL_NỘI_BỘ_VM>
   # Ví dụ: external-ip=35.234.12.34/10.140.0.2
   external-ip=<IP_EXTERNAL_TĨNH_VM_GCP>/<IP_INTERNAL_NỘI_BỘ_VM>

   # Tắt CLI và Multicast để tăng hiệu năng và bảo mật
   no-cli
   no-multicast-peers
   ```
   *Nhấn `Ctrl + O` -> `Enter` để lưu, và `Ctrl + X` để thoát.*

6. Chạy Docker container để khởi động Coturn:
   ```bash
   sudo docker run -d \
     --name coturn-server \
     --network host \
     --restart always \
     -v /opt/coturn/turnserver.conf:/etc/coturn/turnserver.conf \
     coturn/coturn
   ```

7. Kiểm tra xem container đã chạy ổn định chưa:
   ```bash
   sudo docker ps
   sudo docker logs coturn-server
   ```

---

## 🌐 4. Cấu hình DNS trên Cloudflare

1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/) và chọn tên miền của bạn (ví dụ: `yourdomain.com`).
2. Vào mục **DNS** -> **Records**.
3. Nhấp **Add record** và cấu hình như sau:
   - **Type**: `A`
   - **Name**: `turn` (Điều này tạo ra sub-domain `turn.yourdomain.com`)
   - **IPv4 address**: Nhập địa chỉ **IP ngoại vi tĩnh** của GCE VM đã copy ở Bước 3.2.
   - **Proxy status**: 🔘 **DNS Only** (Gạt công tắc sang màu xám để tắt đám mây màu cam).
4. Nhấp **Save**.

---

## 💻 5. Tích hợp cấu hình Bảo mật vào Source Code & GKE

Để đảm bảo bảo mật và tuân thủ các quy tắc của dự án (Không hardcode secrets trong mã nguồn Frontend và không đẩy plain-text secrets lên GitHub):
1. **Thông tin nhạy cảm** (URL, Username, Password) của TURN server được mã hóa Base64 và lưu trong `k8s/secrets.yaml`.
2. **Backend (`chat-service`)** đọc các giá trị này từ Kubernetes Secret ở runtime và cung cấp qua một REST API `/api/conversations/ice-servers`.
3. **Frontend (`CallWindow.jsx`)** tự động gửi request đến API này khi bắt đầu cuộc gọi để lấy thông tin TURN server một cách an toàn.

### Bước 5.1: Cấu hình Kubernetes Secrets (`k8s/secrets.yaml`)
Thêm các khoá sau vào file `k8s/secrets.yaml` (các giá trị dưới đây đã được mã hoá Base64):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: socialhub-secrets
type: Opaque
data:
  # Cấu hình TURN Server cho WebRTC
  # "turn:turn.yourdomain.com:3478" -> dHVybj......=
  TURN_URL: dHVybj......=
  # "socialhub_..." -> c29jaWFsaH....=
  TURN_USERNAME: c29jaWFsaH....=
  # "socialhub_..." -> c29jaWFsaH....
  TURN_CREDENTIAL: c29jaWFsaH....
```
*Lưu ý: Tệp `k8s/secrets.yaml` đã được thêm vào `.gitignore` để không bị đẩy lên GitHub.*

### Bước 5.2: Cấu hình biến môi trường cho Backend (`k8s/chat-service.yaml`)
Để `chat-service` có thể đọc được cấu hình từ Secret, ta khai báo các biến môi trường trong file config deployment:
```yaml
        env:
        - name: TURN_URL
          valueFrom:
            secretKeyRef:
              name: socialhub-secrets
              key: TURN_URL
        - name: TURN_USERNAME
          valueFrom:
            secretKeyRef:
              name: socialhub-secrets
              key: TURN_USERNAME
        - name: TURN_CREDENTIAL
          valueFrom:
            secretKeyRef:
              name: socialhub-secrets
              key: TURN_CREDENTIAL
```

### Bước 5.3: Cập nhật Frontend (`frontend/src/components/CallWindow.jsx`)
Khi khởi chạy WebRTC, component sẽ gọi API đến Backend để nhận cấu hình TURN Server:
```javascript
        const setupWebRTC = async () => {
            try {
                // Tải cấu hình ICE/TURN động từ chat-service qua Gateway
                let serversConfig = ICE_SERVERS;
                try {
                    const res = await api.get("/conversations/ice-servers");
                    if (res.data && res.data.success && res.data.data.iceServers) {
                        serversConfig = { iceServers: res.data.data.iceServers };
                        console.log("📡 [WEBRTC] Tải thành công ICE Servers động từ backend.");
                    }
                } catch (apiErr) {
                    console.warn("⚠️ [WEBRTC] Không thể tải ICE Servers động, sử dụng fallback mặc định:", apiErr);
                }

                // 1. Khởi tạo RTCPeerConnection
                const pc = new RTCPeerConnection(serversConfig);
                peerConnectionRef.current = pc;
```

---

## 🧪 6. Kiểm tra hoạt động (Verification)

Để chắc chắn TURN Server hoạt động chính xác trước khi đưa vào ứng dụng:
1. Truy cập công cụ test WebRTC chuẩn của Google: [Trickle ICE Tool](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/).
2. Xóa tất cả các server mặc định đang có sẵn trong danh sách.
3. Thêm TURN Server của bạn vào:
   - **STUN or TURN URI**: `turn:turn.social....:3478`
   - **TURN username**: `socialhub_...`
   - **TURN password**: `socialhub_...`
4. Nhấn **Add Server**.
5. Nhấn **Gather candidates** ở bên dưới.
6. Quan sát bảng kết quả:
   - Nếu bạn thấy có dòng xuất hiện chữ **`relay`** ở cột **Type**, điều đó có nghĩa là dữ liệu đa phương tiện đã đi qua TURN server thành công. Bạn đã thiết lập hoàn hảo!

---

## 🛠️ 7. Hướng dẫn xử lý sự cố (Troubleshooting)

### Lỗi 1: `STUN/TURN binding/allocate request timed out` (Timeout)
Lỗi này xảy ra khi trình duyệt gửi gói tin đến TURN server nhưng không nhận được phản hồi (bị tường lửa chặn hoặc tiến trình Coturn chưa hoạt động).

**Các bước khắc phục:**

#### Bước 7.1.1: Kiểm tra xem Coturn đã thực sự chạy trên cổng 3478 của VM chưa
SSH vào máy ảo GCE VM và chạy lệnh:
```bash
sudo ss -tulnp | grep 3478
```
- **Nếu có dòng hiển thị** trạng thái `LISTEN` cả `tcp` và `udp` của tiến trình `docker`: Coturn đã chạy tốt trên VM. Lỗi do tường lửa chặn bên ngoài. Hãy kiểm tra các quy tắc Firewall.
- **Nếu không hiển thị gì**: Container Docker đang bị tắt hoặc bị sập. Chạy `sudo docker ps -a` và xem log bằng `sudo docker logs coturn-server` để kiểm tra lỗi cấu hình.

#### Bước 7.1.2: Kiểm tra Quy tắc tường lửa (Firewall Rules) trên Google Cloud Console
Vào **VPC Network** -> **Firewall** và kiểm tra quy tắc `allow-coturn-media-relay`:
- **Source IPv4 ranges**: Đảm bảo là **`0.0.0.0/0`** (nếu để trống hoặc điền sai, GCP sẽ chặn toàn bộ truy cập từ internet).
- **Targets**: Chọn **All instances in the network** (Áp dụng cho tất cả máy ảo trong mạng) để chắc chắn quy tắc đã được gắn vào VM TURN.
- **Protocols and ports**: Đảm bảo đã khai báo mở: **`tcp:3478`** và **`udp:3478,49152-49200`**.

#### Bước 7.1.3: Mở cổng tường lửa nội bộ bên trong hệ điều hành máy ảo (Ubuntu IPTables)
Nhập các lệnh sau trực tiếp trong terminal SSH của máy ảo GCE để mở cổng trong nhân Linux:
```bash
# Mở cổng UFW (nếu Ubuntu đang bật UFW)
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 49152:49200/udp

# Mở cổng IPTables (Bắt buộc cho mạng Google Cloud)
sudo iptables -I INPUT 6 -p udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT 6 -p udp --dport 49152:49200 -j ACCEPT

# Lưu cấu hình IPTables vĩnh viễn
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save
sudo netfilter-persistent reload
```

---

### Lỗi 2: `host lookup received error` (Lỗi 701)
Lỗi này xảy ra khi trình duyệt không thể phân giải tên miền thành địa chỉ IP (DNS Lookup thất bại).

**Các bước khắc phục:**
1. Mở CMD trên máy tính cá nhân của bạn, gõ lệnh:
   ```cmd
   nslookup turn.socialhubzz.cloud
   ```
   Kiểm tra xem kết quả có trả về đúng địa chỉ IP ngoại vi tĩnh của máy ảo GCE hay không. Nếu không, kiểm tra lại cấu hình bản ghi DNS trên Cloudflare.
2. Kiểm tra trạng thái bản ghi DNS trên Cloudflare: Bắt buộc phải là **DNS Only (Đám mây màu xám 🔘)**. Nếu bật Proxy (Đám mây màu cam 🟠), Cloudflare sẽ chặn các gói tin UDP của WebRTC.
3. Tắt các phần mềm VPN, Proxy, hoặc các tiện ích mở rộng chặn WebRTC (như các Extension chặn rò rỉ IP WebRTC) trên trình duyệt trước khi test.

---

## 🚀 8. Các bước triển khai lên cụm GKE (Google Kubernetes Engine)

Sau khi kiểm tra hoạt động của TURN Server thành công bằng Trickle ICE Tool, hãy làm theo các bước sau để áp dụng cấu hình và khởi chạy ứng dụng gọi video trên cụm GKE của bạn:

### Bước 8.1: Mã hóa thông tin cấu hình sang Base64
Để đưa các cấu hình TURN Server vào `k8s/secrets.yaml` an toàn, bạn cần mã hóa thông tin của mình sang Base64.
Trên máy tính hoặc Cloud Shell của bạn, chạy lệnh sau:
- Mã hóa URL TURN Server:
  ```bash
  echo -n "turn:turn.socialhubzz.cloud:3478" | base64
  ```
- Mã hóa Username:
  ```bash
  echo -n "tên_user_của_bạn" | base64
  ```
- Mã hóa Mật khẩu:
  ```bash
  echo -n "mật_khẩu_của_bạn" | base64
  ```

### Bước 8.2: Nạp Secret mới vào cụm GKE
1. Mở file [secrets.yaml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/k8s/secrets.yaml) dưới máy của bạn.
2. Cập nhật các giá trị đã mã hóa Base64 vào các khóa tương ứng:
   ```yaml
   TURN_URL: <chuỗi_base64_của_url>
   TURN_USERNAME: <chuỗi_base64_của_username>
   TURN_CREDENTIAL: <chuỗi_base64_của_password>
   ```
3. Nạp thủ công tệp cấu hình này lên GKE bằng Cloud Shell (hoặc CMD có cấu hình kubectl kết nối với GKE):
   ```bash
   kubectl apply -f k8s/secrets.yaml -n default
   ```
   > [!IMPORTANT]
   > Do tệp `k8s/secrets.yaml` chứa thông tin nhạy cảm và đã được đưa vào tệp `.gitignore`, tuyệt đối không commit tệp này lên GitHub.

### Bước 8.3: Cập nhật và triển khai cấu hình các dịch vụ
1. Triển khai cấu hình định tuyến và pod mới cho `chat-service`:
   ```bash
   kubectl apply -f k8s/chat-service.yaml -n default
   ```
2. Triển khai cấu hình pod mới cho `frontend` (đã được dọn dẹp các biến môi trường plain-text):
   ```bash
   kubectl apply -f k8s/frontend.yaml -n default
   ```
3. Kích hoạt trigger Cloud Build (hoặc đẩy code lên nhánh chính để tự động kích hoạt CI/CD) để đóng gói phiên bản mã nguồn mới nhất cho cả `chat-service` và `frontend`.

### Bước 8.4: Kiểm tra hoạt động thực tế trên ứng dụng
1. Truy cập vào trang giao diện người dùng của bạn trên môi trường HTTPS (ví dụ: `https://gke.yourdomain.com`).
2. Mở tab Console trong Developer Tools của trình duyệt (`F12` -> Console).
3. Thực hiện một cuộc gọi thử nghiệm (gọi video hoặc thoại).
4. Kiểm tra dòng nhật ký in ra: **`📡 [WEBRTC] Tải thành công ICE Servers động từ backend.`**
   Điều này xác nhận frontend đã lấy thành công cấu hình TURN bảo mật từ backend qua API và cuộc gọi được định tuyến an toàn qua TURN Server của bạn.


