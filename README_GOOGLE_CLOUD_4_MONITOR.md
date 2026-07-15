# 📊 Hướng Dẫn Tối Ưu Hóa Logs & Tiết Kiệm Chi Phí Cloud Monitoring (GCP)

Tài liệu này tổng hợp các kỹ thuật cấu hình và tối ưu hóa hệ thống ghi log (logging) cho dự án **SocialHub Microservices** trên cụm **GKE Autopilot** nhằm giảm dung lượng dữ liệu và tiết kiệm tối đa hóa đơn **GCP Cloud Monitoring / Cloud Logging**.

---

## 💸 Tại sao Log dư thừa lại gây tốn chi phí trên Google Cloud?

Mặc định khi bạn chạy ứng dụng trên GKE Autopilot:
1.  **Tự động gom Log (Ingestion)**: Toàn bộ dữ liệu in ra màn hình (`console.log`, `console.info`...) của các container đều được agent của GCP gom lại và gửi về Cloud Logging.
2.  **Cách tính phí**: Google Cloud tính phí dựa trên **dung lượng dữ liệu log/metrics nạp vào (Ingested Data)**. 
3.  **Lượng log hệ thống cực lớn**: Các microservices thường in ra các log lặp đi lặp lại (như câu lệnh truy vấn SQL của Prisma, kết nối Redis thành công, các request kiểm tra sức khỏe `/health` của K8s cứ mỗi vài giây một lần). Nếu chạy 9 Pod liên tục 24/7, lượng log rác này sẽ ngốn hàng chục gigabyte dữ liệu và phát sinh hóa đơn lớn không đáng có.

---

## 🛠️ 3 Tip Kỹ Thuật Đã Tích Hợp Để Tối Ưu Hóa Chi Phí Logs

Để tối ưu hóa, dự án đã được cài đặt sẵn 3 giải pháp kỹ thuật thông minh dưới đây giúp giảm **95% lượng log rác** mà không ảnh hưởng tới việc bắt lỗi khi vận hành thực tế:

### 💡 Tip 1: Ghi đè (Override) console.log toàn cục trên Production
Thay vì phải đi xóa thủ công từng dòng `console.log()` trong toàn bộ dự án, ứng dụng sẽ tự động vô hiệu hóa các log này khi phát hiện môi trường chạy là **`production`**.

Đoạn code này được đặt ở dòng đầu tiên của file chạy chính (`index.js` hoặc `server.js`) ở cả 7 microservices:
```javascript
if (process.env.ENVIRONMENT === 'production') {
  console.log = () => {};
  console.info = () => {};
  console.debug = () => {};
  // CHỈ giữ lại console.warn và console.error để ghi nhận lỗi thực tế
}
```
*   **Hiệu quả**: Loại bỏ toàn bộ log debug thông tin của ứng dụng và của cả các thư viện npm bên thứ ba.
*   **An toàn**: Các lỗi nghiêm trọng (được in ra bằng `console.error`) vẫn được ghi nhận đầy đủ lên GCP để bạn debug khi cần.

### 💡 Tip 2: Tinh giảm log HTTP của Morgan
Morgan là thư viện ghi log request gửi đến Express. Mặc định nó sẽ ghi log tất cả request thành công (200 OK) của người dùng và các request ping kiểm tra sức khỏe của Kubernetes.

Đoạn code Morgan đã được cấu hình trong `app.js` của API Gateway và Media Service:
```javascript
if (process.env.ENVIRONMENT !== 'production') {
  app.use(morgan('dev')); // Ở local log chi tiết
} else {
  // Ở production, chỉ ghi log các request gặp lỗi (Status Code >= 400)
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400
  }));
}
```
*   **Hiệu quả**: Loại bỏ toàn bộ các log ping `/health` tự động của K8s, chỉ lưu giữ log khi người dùng gặp lỗi (4xx hoặc 5xx).

### 💡 Tip 3: Tắt log câu lệnh SQL (Prisma Query Logs)
Prisma mặc định có thể in toàn bộ câu lệnh SQL truy vấn cơ sở dữ liệu ra màn hình. Khi có nhiều người dùng, log này sẽ gây tràn ngập màn hình điều khiển.

Đoạn cấu hình đã sửa tại `services/post-service/src/config/db.js`:
```javascript
const prisma = new PrismaClient(
  process.env.ENVIRONMENT === 'production'
    ? { log: ['error'] } // Prod chỉ log lỗi
    : { log: ['info', 'warn', 'error'] } // Dev log toàn bộ
);
```

---

## ⚙️ Cơ Chế Kích Hoạt Tự Động Trên GKE

Hệ thống nhận diện môi trường thông qua biến cấu hình tập trung tại **`k8s/configmap.yaml`**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: socialhub-config
data:
  ENVIRONMENT: "production" # <--- Kích hoạt chế độ Prod tắt log trên GKE
```

Khi bạn deploy lên GKE, biến `ENVIRONMENT: "production"` sẽ được K8s nạp trực tiếp vào biến môi trường của hệ điều hành container. Các Node.js microservices khi khởi chạy sẽ lập tức kích hoạt bộ lọc log mà bạn không cần cấu hình thêm gì cả.

---

## 🧹 Cách Vệ Sinh & Tắt Log Tuyệt Đối Khi Không Phát Triển

Dù đã tối ưu log, việc duy trì cụm GKE khi không làm việc vẫn làm phát sinh phí quản lý cụm cố định của Google (~$72/tháng). Hãy áp dụng quy trình sau để đưa chi phí dự án về **0 USD**:

1.  **Khi tạm nghỉ code (vài ngày/vài tuần)**: 
    Hãy xóa sạch cụm GKE để tắt hoàn toàn mọi luồng sinh log/metrics và thu hồi VM:
    ```bash
    gcloud container clusters delete socialhub-gke-cluster --region=asia-east1 --quiet
    ```
2.  **Tắt database Cloud SQL**:
    Tắt máy chủ DB để không bị tính tiền CPU/RAM rảnh rỗi:
    ```bash
    gcloud sql instances patch socialhub-db-postgres --activation-policy=NEVER
    ```

---

## 📈 PHẦN 2: Giám Sát Cụm GKE Với Google Cloud Managed Service for Prometheus (GMP)

Google Cloud cung cấp dịch vụ quản lý Prometheus hoàn toàn tự động tích hợp sẵn trên GKE Autopilot (**Google Cloud Managed Service for Prometheus - GMP**). Dịch vụ này giúp thu thập metrics hệ thống mà không cần tự duy trì hạ tầng Prometheus server phức tạp.

### 1. Kích hoạt Managed Prometheus trên GKE
Mặc định trên GKE Autopilot, tính năng này được bật sẵn. Nếu chạy trên GKE Standard hoặc muốn xác minh cấu hình, hãy chạy lệnh:
```bash
gcloud container clusters update socialhub-gke-cluster \
    --enable-managed-prometheus \
    --region=asia-east1
```

### 2. Thiết lập PodMonitoring để thu thập Node.js Metrics
Để Prometheus thu thập metrics (như CPU, Memory, HTTP Request Rate, Error Rate) từ các Pod Node.js Microservices, chúng ta tạo một tài nguyên `PodMonitoring` của GCP.

*Ví dụ cấu hình thu thập metrics từ API Gateway (`k8s/pod-monitoring-gateway.yaml`):*
```yaml
apiVersion: monitoring.gke.io/v1
kind: PodMonitoring
metadata:
  name: gateway-monitoring
  namespace: default
spec:
  selector:
    matchLabels:
      app: gateway
  endpoints:
  - port: 8000
    path: /metrics
    interval: 30s
```
*Lệnh apply:*
```bash
kubectl apply -f k8s/pod-monitoring-gateway.yaml
```

### 3. Hiển thị Metrics trên Cloud Monitoring & Grafana
*   **GCP Cloud Monitoring**: Bạn có thể vào phần **Monitoring** -> **Dashboards** trên GCP Console để tạo biểu đồ trực quan truy vấn PromQL trực tiếp từ GMP.
*   **Grafana**: Bạn có thể cấu hình Grafana kết nối trực tiếp với Cloud Monitoring thông qua xác thực Service Account GCP (yêu cầu quyền `roles/monitoring.viewer`).

---

## ☸️ PHẦN 3: Tích Hợp Cụm GKE Với Bộ Công Cụ Argo (Argo CD & Argo Rollouts)

Bộ công cụ Argo (Argo CD và Argo Rollouts) là các giải pháp GitOps và Progressive Delivery chuẩn Kubernetes, giúp tự động hóa quá trình deploy và theo dõi sức khỏe (health monitoring) của ứng dụng một cách trực quan.

### 1. Cài đặt & Giám sát GitOps bằng Argo CD
Argo CD liên tục đồng bộ trạng thái thực tế chạy trên GKE với các tệp Manifests được định nghĩa trong Git. Nó đóng vai trò là "Bảng điều khiển sức khỏe" (Health Dashboard) cho các microservices.

#### Bước 1: Triển khai Argo CD lên GKE
Chạy các lệnh sau trên Cloud Shell:
```bash
# Tạo namespace riêng biệt
kubectl create namespace argocd

# Cài đặt Argo CD bản ổn định
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

#### Bước 2: Truy cập Dashboard Argo CD
1.  **Lấy mật khẩu tài khoản admin mặc định**:
    ```bash
    kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
    ```
2.  **Mở cổng Port-Forward** để truy cập từ máy cá nhân:
    ```bash
    kubectl port-forward svc/argocd-server -n argocd 8080:443
    ```
3.  Mở trình duyệt truy cập `https://localhost:8080` (đăng nhập với tên đăng nhập `admin` và mật khẩu lấy ở bước trên).

#### Bước 3: Giám sát sức khỏe ứng dụng
Khi bạn trỏ Argo CD tới repository Git chứa thư mục `k8s/`, Argo CD sẽ tự động quét và vẽ biểu đồ toàn bộ vòng đời của 9 Pod. Bạn có thể giám sát trạng thái sức khỏe trực quan:
*   🟢 **Healthy**: Pod hoạt động bình thường, sẵn sàng xử lý request.
*   🔴 **Degraded**: Pod bị lỗi (CrashLoopBackOff, thiếu secret, DB chết hoặc kết nối thất bại).
*   🟡 **OutOfSync**: Mã nguồn manifests trên GitHub khác so với những gì đang chạy trên GKE.

---

### 2. Tự Động Hóa Giám Sát & Rollback Với Argo Rollouts (Canary Deployment)
Argo Rollouts thay thế Kubernetes Deployments mặc định để thực hiện triển khai dạng Canary (ví dụ: chuyển 10% traffic sang phiên bản mới trước, nếu tốt mới chuyển tiếp). Nó tích hợp với Prometheus để tự động rollback khi tỉ lệ lỗi tăng.

#### Bước 1: Cài đặt Argo Rollouts Controller
```bash
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
```

#### Bước 2: Cấu hình Tự Động Phân Tích Metrics (AnalysisTemplate)
Tạo tệp `k8s/analysis-template.yaml` để cấu hình Argo Rollouts tự động truy vấn Prometheus GMP cứ mỗi 30 giây để kiểm tra tỉ lệ thành công (Success Rate) của HTTP requests trên API Gateway:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: gateway-success-rate-check
  namespace: default
spec:
  metrics:
  - name: success-rate
    interval: 30s
    successCondition: result[0] >= 0.99  # Yêu cầu tỉ lệ request thành công >= 99% (Lỗi < 1%)
    failureLimit: 1
    provider:
      prometheus:
        address: http://prometheus-operated.monitoring.svc:9090 # Địa chỉ Service DNS của Prometheus GMP
        query: |
          sum(rate(nginx_ingress_controller_requests{status=~"2.*|3.*|4.*"}[1m])) 
          / 
          sum(rate(nginx_ingress_controller_requests[1m]))
```

#### Bước 3: Cơ chế Giám sát tự động của Argo Rollouts
Khi bạn cập nhật phiên bản mới (ví dụ: update image tag mới của `user-service`):
1.  Argo Rollouts triển khai phiên bản mới và chuyển **10% lượng traffic** của người dùng sang đó.
2.  Argo Rollouts kích hoạt tiến trình phân tích `gateway-success-rate-check` truy vấn metrics từ Prometheus GMP.
3.  **Kịch bản 1 (Mọi thứ hoạt động tốt):** Metrics trả về tỉ lệ thành công `>= 99%`. Sau khoảng thời gian chờ (ví dụ: 10 phút), Argo Rollouts sẽ tự động tăng dần traffic lên 50% rồi 100%, hoàn tất việc triển khai bản mới.
4.  **Kịch bản 2 (Bản code mới bị bug kết nối DB hoặc Crash):** Tỉ lệ thành công tụt xuống dưới 99% (lỗi >= 1%). Metrics kiểm thử không đạt yêu cầu, Argo Rollouts ngay lập tức **ngắt tiến trình triển khai và tự động rollback 100% traffic** của người dùng về phiên bản cũ an toàn. Kỹ sư không cần can thiệp thủ công và người dùng cuối không bị gián đoạn dịch vụ.
