# Hướng Dẫn Tích Hợp CI/CD Lên Google Cloud Platform (GCP)

Tài liệu này hướng dẫn chi tiết cách thiết lập hệ thống tích hợp và triển khai liên tục (CI/CD) cho dự án **SocialHub Microservices** lên cụm **GKE Autopilot** (vùng `asia-east1`).

Chúng ta có **2 phương pháp** chính để thiết lập pipeline. Vui lòng chọn một phương pháp phù hợp với luồng công việc của bạn:

---

## ⚡ Các Tối Ưu Hóa Quan Trọng Đã Cấu Hình
*   **Tốc độ Build cực nhanh**: Cả hai cách đều hỗ trợ build song song 7 microservices cùng lúc. Trong `cloudbuild.yaml`, ta sử dụng máy ảo lớn cấu hình cao **`E2_HIGHCPU_8`** (8 vCPUs, 8 GB RAM) giúp rút ngắn thời gian build từ 30 phút xuống còn 3 - 5 phút.
*   **Tiết kiệm chi phí**: Mọi tác vụ build, registry và deploy đều được neo chặt tại vùng **`asia-east1`** (Đài Loan) để giảm tối đa chi phí truyền tải dữ liệu liên vùng (cross-region data transfer) và tận dụng hạ tầng có sẵn.
*   **Spot Pods**: Các file Kubernetes manifests tại thư mục [k8s/](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/k8s) đã được cấu hình mặc định chạy trên **Spot VMs** để giảm 60 - 90% chi phí chạy node.

---

## 🛠️ CÁCH 1: Google Cloud Build (Tích hợp All-in-GCP)

Phương pháp này sử dụng trực tiếp công cụ Google Cloud Build để lắng nghe sự kiện push code trên GitHub và tự động chạy file [cloudbuild.yaml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/cloudbuild.yaml).

### 1. Chuẩn bị quyền cho Cloud Build Service Account
Để Cloud Build có quyền ghi ảnh Docker vào Artifact Registry và ra lệnh deploy lên GKE, hãy chạy các lệnh cấp quyền sau trên Cloud Shell (nếu trước đây bạn chưa chạy ở Bước 6):

```bash
# Lấy Project Number của dự án
PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")
BUILD_SA="${PROJECT_NUM}@cloudbuild.gserviceaccount.com"

# Cấp quyền đẩy Docker image lên Artifact Registry
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/artifactregistry.writer"

# Cấp quyền triển khai ứng dụng vào cụm GKE
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/container.developer"
```

### 2. Liên kết kho chứa GitHub và Tạo Trigger trên Console
Cách dễ nhất để tạo trigger tự động khi push code GitHub là thao tác trên giao diện GCP Console:

1.  Truy cập vào trang **Cloud Build** trên GCP Console.
2.  Chọn tab **Triggers** và nhấp vào **Manage Repositories** -> **Connect Repository** (Thế hệ 2).
3.  Chọn nhà cung cấp là **GitHub**, đăng nhập tài khoản GitHub và chọn repo `SocialHub_Microservices`.
4.  Quay lại trang Triggers, nhấn **Create Trigger**:
    *   **Name**: `socialhub-github-trigger`
    *   **Region**: Chọn **`asia-east1`** (Bắt buộc chọn vùng này để trigger chạy trên các worker pool tối ưu chi phí).
    *   **Event**: `Push to a branch`
    *   **Repository**: Chọn repo đã kết nối ở trên.
    *   **Branch**: `^main$` (Hoặc `^master$`)
    *   **Configuration**: Chọn `Cloud Build configuration file (yaml or json)`
    *   **Cloud Build configuration file location**: `/cloudbuild.yaml` (Mặc định ở thư mục gốc).
5.  Nhấn **Create** để hoàn thành.

### 3. Lệnh chạy thử nghiệm thủ công (Manual Trigger)
Nếu bạn muốn kích hoạt build và deploy ngay lập tức từ máy tính cá nhân (hoặc Cloud Shell) bằng file cấu hình tối ưu cấu hình cao mà không cần push code lên GitHub:

```bash
# Gửi tác vụ build lên Cloud Build tại vùng asia-east1
gcloud builds submit \
    --config=cloudbuild.yaml \
    --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD) \
    --region=asia-east1 .
```

### 4. Lệnh dọn dẹp (Xóa Trigger)
Nếu bạn không muốn sử dụng Cloud Build Trigger nữa để tránh việc vô tình build gây tốn tiền:

```bash
gcloud beta builds triggers delete socialhub-github-trigger --region=asia-east1 --quiet
```

---

## 🤖 CÁCH 2: GitHub Actions (Tích hợp qua Workload Identity Federation)

Phương pháp này điều phối pipeline từ GitHub Actions thông qua file [.github/workflows/gke-deploy.yml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/.github/workflows/gke-deploy.yml). Cách này sử dụng cơ chế bảo mật **Workload Identity Federation (WIF)** để GitHub tự cấu hình token đăng nhập ngắn hạn vào GCP mà không cần lưu khóa JSON (Service Account Key) nguy hiểm trên GitHub Secrets.

### 1. Tạo Service Account riêng cho GitHub Actions
Mở Cloud Shell và chạy lệnh tạo tài khoản dịch vụ:

```bash
gcloud iam service-accounts create socialhub-github-sa \
    --display-name="GitHub Actions Service Account"
```

### 2. Cấp quyền IAM cho Service Account của GitHub
```bash
# Đẩy ảnh Docker lên Artifact Registry
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer"

# Triển khai và quản lý tài nguyên trên cụm GKE
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com" \
    --role="roles/container.developer"
```

### 3. Tạo Workload Identity Pool & Provider cho GitHub
Tạo cổng kết nối tin cậy giữa GitHub và GCP:

```bash
# A. Tạo Workload Identity Pool
gcloud iam workload-identity-pools create socialhub-wif-pool \
    --location=global \
    --display-name="SocialHub WIF Pool"

# B. Tạo OIDC Provider cho GitHub Actions kết nối
gcloud iam workload-identity-pools providers create-oidc socialhub-github-provider \
    --location=global \
    --workload-identity-pool=socialhub-wif-pool \
    --display-name="SocialHub GitHub Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.subject,attribute.repository=assertion.repository,attribute.actor=assertion.actor"
```

### 4. Liên kết Provider với Service Account
Cho phép các luồng chạy từ repository GitHub cụ thể của bạn được giả danh (impersonate) Service Account đã tạo ở bước 1:

```bash
# Lấy Project Number của dự án
PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")

# Thực hiện bind quyền (Hãy thay thế 'YOUR_GITHUB_USERNAME/repo-name' bằng repo thật của bạn)
# Ví dụ: 'cong23122004/SocialHub_Microservices'
gcloud iam service-accounts add-iam-policy-binding socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUM}/locations/global/workloadIdentityPools/socialhub-wif-pool/attribute.repository/YOUR_GITHUB_USERNAME/SocialHub_Microservices"
```

### 5. Cấu hình lại File Workflow
Mở file [.github/workflows/gke-deploy.yml](file:///d:/Hoc_tap_Project_complete/SocialHub_Microservices/.github/workflows/gke-deploy.yml):
1.  Tìm khóa `WIF_PROVIDER` ở đầu file và thay thế `YOUR_PROJECT_NUMBER` bằng Project Number thực tế của bạn.
2.  Đảm bảo trường `WIF_SERVICE_ACCOUNT` trỏ đúng tới địa chỉ email Service Account: `socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com`.

### 6. Cách kích hoạt chạy thử nghiệm (Test)
Bạn chỉ cần thực hiện commit code và push trực tiếp lên branch `main`:
```bash
git add .
git commit -m "feat: setup GitHub Actions CI/CD with GKE Spot VMs"
git push origin main
```
Sau đó truy cập tab **Actions** trên Repository GitHub của bạn để xem quá trình build matrix (7 máy ảo GitHub chạy song song để build Docker) và deploy tự động lên cụm GKE.

### 7. Lệnh dọn dẹp (Xóa cấu hình WIF & Service Account)
Khi kết thúc dự án và muốn xóa bỏ các kết nối bảo mật này:

```bash
# 1. Xóa OIDC Provider
gcloud iam workload-identity-pools providers delete socialhub-github-provider \
    --workload-identity-pool=socialhub-wif-pool \
    --location=global --quiet

# 2. Xóa Workload Identity Pool
gcloud iam workload-identity-pools delete socialhub-wif-pool \
    --location=global --quiet

# 3. Xóa Service Account của GitHub
gcloud iam service-accounts delete socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com --quiet
```
