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

## 🔒 Khóa Vùng Lưu Trữ Logs (Data Residency) Tại asia-east1

Mặc định khi chạy trên GKE, GCP Cloud Logging sẽ lưu trữ logs của bạn tại vị trí `global`. Nếu bạn muốn đảm bảo toàn bộ dữ liệu log được lưu trữ vật lý duy nhất tại vùng **`asia-east1`** (Đài Loan) để đáp ứng yêu cầu bảo mật, chủ quyền dữ liệu (Data Residency) và quản lý tập trung:

### Bước 1: Tạo Log Bucket tại vùng `asia-east1`
Mở Cloud Shell và chạy lệnh dưới đây để tạo một Log Bucket mới có thời gian lưu trữ (retention) là 30 ngày:
```bash
gcloud logging buckets create socialhub-gke-logs-bucket \
    --location=asia-east1 \
    --retention-days=30 \
    --description="Lưu trữ logs GKE duy nhất tại vùng asia-east1"
```

### Bước 2: Tạo Log Router Sink để định tuyến log GKE về bucket mới
Tạo một Sink định tuyến để chuyển toàn bộ logs Kubernetes (containers, nodes, cluster) về Log Bucket ở `asia-east1` vừa tạo:
```bash
# Thay [PROJECT_ID] bằng ID dự án GCP thực tế của bạn
gcloud logging sinks create gke-asia-east1-sink \
    logging.googleapis.com/projects/socialhub-micro-service-1/locations/asia-east1/buckets/socialhub-gke-logs-bucket \
    --log-filter='resource.type="k8s_container" OR resource.type="k8s_node" OR resource.type="k8s_cluster"' \
    --description="Chuyển hướng toàn bộ log GKE về vùng asia-east1"
```

### Bước 3: Loại trừ log GKE khỏi Sink mặc định `_Default` để tránh bị tính phí trùng lặp
Để tránh logs bị nhân đôi ở cả bucket `global` mặc định và bucket `asia-east1` mới (gây tốn gấp đôi chi phí):
1. Truy cập **GCP Console** -> **Logging** -> **Log Router**.
2. Tìm sink tên là `_Default` -> Chọn **Edit sink**.
3. Tại phần **Exclusion filters** (Bộ lọc loại trừ), nhấn **Add Exclusion** và điền:
   - **Filter Name**: `Exclude_GKE_logs`
   - **Filter**: `resource.type="k8s_container" OR resource.type="k8s_node" OR resource.type="k8s_cluster"`
4. Lưu cấu hình (Save).

---


## 📈 PHẦN 2: Giám Sát Chi Tiết Với Google Cloud Managed Service for Prometheus (GMP)

Để Prometheus có thể thu thập metrics từ ứng dụng Node.js, bạn cần thực hiện 3 bước: tích hợp thư viện vào code, tạo tệp cấu hình Kubernetes `PodMonitoring`, và xem biểu đồ trên GCP.

### 1. Tích hợp `prom-client` vào ứng dụng Node.js (Ví dụ: `api-gateway`)

#### Bước 1.1: Cài đặt thư viện `prom-client`
Di chuyển vào thư mục dịch vụ (ví dụ: `gateway/` hoặc `services/user-service/`) và cài đặt:
```bash
npm install prom-client
```

#### Bước 1.2: Viết code expose metrics trong Express App
Sửa file khởi tạo ứng dụng (ví dụ: `gateway/src/app.js` hoặc `gateway/src/server.js`) để đăng ký và expose endpoint `/metrics`:

```javascript
import express from 'express';
import client from 'prom-client';

const app = express();

// 1. Khởi tạo thu thập metrics mặc định (CPU, Memory, Event Loop, Garbage Collection...)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

// 2. Tạo custom metric để đo số lượng HTTP Requests và độ trễ (Latency)
const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Tổng số HTTP requests nhận được',
  labelNames: ['method', 'route', 'status']
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Độ trễ của HTTP requests tính bằng giây',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5] // Các mốc thời gian để đo lường
});

// Middleware ghi nhận metric cho mọi request
app.use((req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;
    const route = req.route ? req.route.path : req.path;

    // Chỉ log metrics nếu không phải là ping check sức khỏe /health
    if (route !== '/health' && route !== '/metrics') {
      httpRequestCounter.inc({ method: req.method, route, status: res.statusCode });
      httpRequestDuration.observe({ method: req.method, route, status: res.statusCode }, duration);
    }
  });

  next();
});

// 3. Expose endpoint /metrics cho Prometheus thu thập dữ liệu
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

---

### 2. Thiết lập cấu hình PodMonitoring trên Kubernetes

GKE Autopilot sử dụng tài nguyên tùy chỉnh `PodMonitoring` (CRD) để tìm kiếm các pod có cổng `/metrics` và kéo dữ liệu về Cloud Monitoring.

Hãy tạo tệp `k8s/pod-monitoring-gateway.yaml`:
```yaml
apiVersion: monitoring.gke.io/v1
kind: PodMonitoring
metadata:
  name: gateway-monitoring
  namespace: default
spec:
  # Lựa chọn các Pod có nhãn (label) app: gateway
  selector:
    matchLabels:
      app: gateway
  endpoints:
  - port: 8000       # Port mà container gateway đang lắng nghe
    path: /metrics   # URL endpoint xuất metrics
    interval: 30s    # Tần suất kéo dữ liệu (30 giây một lần)
```
Áp dụng cấu hình lên cụm:
```bash
kubectl apply -f k8s/pod-monitoring-gateway.yaml
```

---

### 3. Kiểm tra và Hiển thị trên GCP Cloud Monitoring

1. Truy cập **GCP Console** -> **Monitoring** -> **Metrics Explorer**.
2. Nhấp chọn **PromQL** để sử dụng ngôn ngữ truy vấn Prometheus.
3. Nhập các câu lệnh truy vấn mẫu:
   * **Đo số lượng Request/giây (Tần suất tải)**:
     ```promql
     sum(rate(http_requests_total[1m]))
     ```
   * **Độ trễ trung bình của API Gateway (giây)**:
     ```promql
     sum(rate(http_request_duration_seconds_sum[1m])) / sum(rate(http_request_duration_seconds_count[1m]))
     ```
   * **Tỉ lệ RAM tiêu thụ của các Pod**:
     ```promql
     container_memory_working_set_bytes{container="gateway"}
     ```

---

## ☸️ PHẦN 3: Tích Hợp GitOps & Canary Deploy Với Argo CD & Argo Rollouts

Hạ tầng GitOps giúp tự động đồng bộ code từ Github lên GKE, còn Argo Rollouts giúp cập nhật ứng dụng dạng Canary (chuyển 10% traffic trước, nếu lỗi tự động Rollback).

### 1. Triển khai & Cấu hình Argo CD

#### Bước 1.1: Cài đặt Argo CD lên cụm GKE
Chạy lệnh sau trên Cloud Shell để cài đặt Argo CD:
```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

#### Bước 1.2: Đăng nhập vào giao diện Dashboard Argo CD
1. **Lấy mật khẩu tài khoản `admin` mặc định**:
   ```bash
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
   ```
2. **Mở cổng kết nối Port-Forward**:
   ```bash
   kubectl port-forward svc/argocd-server -n argocd 8080:443
   ```
3. Truy cập vào trình duyệt web địa chỉ `https://localhost:8080` (Tài khoản: `admin` / Mật khẩu lấy ở bước trên).

#### Bước 1.3: Khởi tạo GitOps Application đồng bộ thư mục `k8s/`
Tạo tệp cấu hình `argocd-application.yaml` để Argo CD tự động theo dõi Github của bạn:
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: socialhub-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: 'https://github.com/[YOUR_GITHUB_USER]/[YOUR_REPO_NAME].git' # Thay đường dẫn Git của bạn
    targetRevision: HEAD
    path: k8s # Thư mục chứa các file YAML k8s cần đồng bộ
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: default
  syncPolicy:
    automated:
      prune: true     # Tự xóa các tài nguyên trên K8s nếu file YAML của chúng bị xóa trên Git
      selfHeal: true  # Tự sửa lại tài nguyên trên K8s nếu bị sửa thủ công sai cấu hình trên cụm
```
Apply cấu hình để kích hoạt đồng bộ tự động:
```bash
kubectl apply -f argocd-application.yaml
```

---

### 2. Tự Động Hóa Canary Deploy Với Argo Rollouts

Argo Rollouts thay thế `Deployment` mặc định để bổ sung tính năng chạy Canary thông minh.

#### Bước 2.1: Triển khai Argo Rollouts Controller
Chạy lệnh sau trên Cloud Shell để cài đặt:
```bash
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
```

#### Bước 2.2: Chuyển đổi file K8s Deployment thành Rollout (Ví dụ: `gateway.yaml`)
Sửa đổi file manifest `k8s/gateway.yaml` từ `kind: Deployment` thành `kind: Rollout`:

```yaml
apiVersion: argoproj.io/v1alpha1 # Đổi apiVersion
kind: Rollout                   # Đổi từ Deployment -> Rollout
metadata:
  name: gateway
  labels:
    app: gateway
spec:
  replicas: 2
  strategy:
    canary:
      # Định nghĩa các bước chuyển tiếp traffic cho phiên bản mới (Canary)
      steps:
      - setWeight: 10   # Chuyển 10% traffic sang bản mới
      - pause: { duration: 5m } # Tạm dừng 5 phút để theo dõi lỗi
      - setWeight: 50   # Nếu tốt, tăng lên 50% traffic
      - pause: { duration: 2m } # Tạm dừng tiếp 2 phút
      # Sau đó tự động tăng lên 100% hoàn thành cập nhật bản mới
  selector:
    matchLabels:
      app: gateway
  template:
    metadata:
      labels:
        app: gateway
    spec:
      nodeSelector:
        cloud.google.com/gke-spot: "true"
      tolerations:
      - key: "cloud.google.com/gke-spot"
        operator: "Equal"
        value: "true"
        effect: "NoSchedule"
      containers:
      - name: gateway
        image: IMAGE_PLACEHOLDER_GATEWAY
        ports:
        - containerPort: 8000
        # ... (các phần env và resources giữ nguyên như cũ)
```

---

### 3. Tự động Rollback dựa trên lỗi (AnalysisTemplate)

Khi phiên bản mới có lỗi (như lỗi kết nối DB, crash code), chúng ta cần Argo Rollouts tự động phát hiện qua Prometheus và rollback về phiên bản cũ ngay lập tức.

#### Bước 3.1: Tạo file cấu hình `k8s/analysis-template.yaml`
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
    successCondition: result[0] >= 0.95  # Yêu cầu tỉ lệ request thành công >= 95% (lỗi < 5%)
    failureLimit: 2                      # Cho phép tối đa 2 lần kiểm tra thất bại trước khi kích hoạt Rollback
    provider:
      prometheus:
        # Thay thế bằng URL API của Google Cloud Managed Service for Prometheus trong cụm của bạn
        address: http://frontend-gmp.monitoring.svc:9090
        query: |
          sum(rate(http_requests_total{status!~"5.*"}[1m])) 
          / 
          sum(rate(http_requests_total[1m]))
```

#### Bước 3.2: Gắn AnalysisTemplate vào chiến lược Canary của Rollout
Sửa phần `strategy` trong file `k8s/gateway.yaml`:
```yaml
spec:
  strategy:
    canary:
      analysis:
        templates:
        - templateName: gateway-success-rate-check
        args:
        - name: service-name
          value: gateway
      steps:
      - setWeight: 10
      - pause: { duration: 5m } # Trong 5 phút này, AnalysisTemplate sẽ liên tục chạy truy vấn cứ mỗi 30s. Nếu successCondition thất bại quá 2 lần, Rollout lập tức ngắt tiến trình và rollback 100% traffic về bản cũ.
      - setWeight: 50
      - pause: { duration: 2m }
```

---

## 🚀 Quy Trình Vận Hành Hàng Ngày Khi Code

1. **Viết Code mới**: Bạn cập nhật mã nguồn, ví dụ sửa API Gateway.
2. **Push Code**: Đẩy code lên Github.
3. **Cloud Build chạy**: Tự động build Docker Image mới và push lên Artifact Registry.
4. **Argo CD phát hiện**:
   * Quét thấy file YAML trên Github được update thẻ Image mới.
   * Đồng bộ hóa và cập nhật tài nguyên `Rollout gateway` trên GKE.
5. **Argo Rollouts triển khai**:
   * Tạo pod phiên bản mới, cấu hình Ingress chuyển **10% traffic** sang pod mới này.
   * Kích hoạt `AnalysisTemplate` truy vấn metrics từ **Prometheus (GMP)**.
   * **Nếu thành công**: Sau 5 phút, tự động tăng dần traffic lên 100% và dọn dẹp pod cũ.
   * **Nếu phát hiện lỗi**: Rollout lập tức trả toàn bộ traffic về pod cũ, hủy các pod mới có lỗi.
