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

### 1. Tạo và cấp quyền cho Dedicated Service Account của Cloud Build
Theo chuẩn bảo mật mới nhất của Google Cloud, các Service Account mặc định (như `@cloudbuild.gserviceaccount.com`) sẽ **không được hiển thị** trong danh sách dropdown vì chúng là tài khoản do Google quản lý. Để thực thi Trigger một cách an toàn và có thể lựa chọn được trong dropdown, bạn cần tạo một **User-Managed Service Account chuyên dụng** (Dedicated Service Account):

Mở Cloud Shell và chạy chuỗi lệnh sau để tạo và cấp quyền:

```bash
# 1. Khai báo ID dự án và lấy Project Number
PROJECT_ID="socialhub-micro-service-1"
PROJECT_NUM=$(gcloud projects describe ${PROJECT_ID} --format="value(projectNumber)")

# 2. Tạo Service Account chuyên dụng cho Cloud Build
gcloud iam service-accounts create socialhub-build-sa \
    --display-name="SocialHub Cloud Build Execution SA"

# 3. Cấp quyền ghi log cho Service Account mới
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter" \
    --condition=None

# 4. Cấp quyền đẩy ảnh Docker vào Artifact Registry
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/artifactregistry.writer" \
    --condition=None

# 5. Cấp quyền Deploy ứng dụng lên cụm GKE
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/container.developer" \
    --condition=None

# 6. Cấp quyền đọc Token của Developer Connect (để kéo code từ GitHub)
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/developerconnect.readTokenAccessor" \
    --condition=None

# 7. Cấp quyền chạy cho Service Agent của Cloud Build (Bắt buộc để Cloud Build có quyền giả danh tài khoản này)
gcloud iam service-accounts add-iam-policy-binding socialhub-build-sa@${PROJECT_ID}.iam.gserviceaccount.com \
    --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountUser"

# 8. Cấp quyền Token Accessor cho Service Agent của Cloud Build
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
    --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
    --role="roles/developerconnect.tokenAccessor" \
    --condition=None
```

### 2. Liên kết kho chứa GitHub và Tạo Trigger trên Console (Thông qua Developer Connect - 2nd gen)
Theo chuẩn mới nhất của Google Cloud, việc kết nối kho lưu trữ GitHub được quản lý tập trung thông qua dịch vụ **Developer Connect** (Thế hệ 2):

1.  **Thiết lập kết nối (Connection)**:
    *   Trong Google Cloud Console, tìm kiếm và truy cập vào dịch vụ **Developer Connect**.
    *   Click **Create Connection**, chọn nhà cung cấp là **GitHub**.
    *   Chọn Vùng (Region) hoạt động là **`asia-east1`** (Bắt buộc để giữ toàn bộ pipeline hoạt động tại vùng này).
    *   Click **Continue** và làm theo hướng dẫn để cấp quyền truy cập (OAuth) cho Google Developer Connect cài đặt GitHub App trên tài khoản GitHub của bạn.
2.  **Liên kết Repo (Link Repositories)**:
    *   Tại giao diện Developer Connect, chuyển đến mục **Repositories**.
    *   Click **Link repository**, chọn kết nối bạn vừa tạo và chọn kho lưu trữ `SocialHub_Microservices`.
    *   Click **Link** để hoàn thành liên kết.
3.  **Tạo Trigger trong Cloud Build**:
    *   Mở trang **Cloud Build** -> Chọn tab **Triggers** -> Click **Create Trigger**.
    *   **Name**: `socialhub-github-trigger`
    *   **Region**: Chọn **`asia-east1`** (Đảm bảo khớp với vùng của kết nối và cụm GKE).
    *   **Event**: `Push to a branch`
    *   **Source**: Chọn **Repository (2nd gen)**.
    *   **Repository**: Chọn repo đã liên kết qua Developer Connect ở bước trên.
    *   **Branch**: `^main$` (Hoặc `^master$`)
    *   **Approval**: **Không chọn / Để trống** (Không tích vào ô *"Require approval before build executes"*. Nếu tích chọn ô này, mỗi lần bạn push code lên GitHub, build sẽ bị tạm dừng và bắt bạn phải vào GCP Console phê duyệt thủ công thì build mới chạy). Bạn sẽ phải đăng nhập vào Google Cloud Console, tìm đến tab Cloud Build, và bấm nút "Approve" (Duyệt) thủ công thì build mới bắt đầu chạy.
        * Sau khi bạn đã tạo Trigger xong, nếu sau này muốn thay đổi cấu hình (bật hoặc tắt tính năng duyệt thủ công), bạn chỉ cần làm như sau:
            * Vào trang Cloud Build -> Chọn tab Triggers.
            * Click vào tên trigger của bạn (socialhub-github-trigger) hoặc bấm vào dấu 3 chấm ở góc phải và chọn Edit (Sửa).
            * Cuộn xuống phần Approval và tích chọn hoặc bỏ tích chọn ô "Require approval before build executes".
            * Kéo xuống cuối trang và bấm Save (Lưu).
    *   **Configuration**: Chọn `Cloud Build configuration file (yaml or json)`
    *   **Cloud Build configuration file location**: `/cloudbuild.yaml` (Mặc định ở thư mục gốc).
    *   **Service Account** (Mục Nâng cao/Advanced): Chọn **`socialhub-build-sa@socialhub-micro-service-1.iam.gserviceaccount.com`** (Tài khoản chuyên dụng đã tạo và cấp quyền ở Bước 1).
4.  Nhấn **Create** để hoàn tất cấu hình tự động.

> ⚠️ **LƯU Ý SỬA LỖI (Troubleshooting - Lỗi cấu hình Trigger)**:
> 
> *   **Trường hợp 1: Chỉ chọn được Connection nhưng không chọn được Repository (Danh sách Repo bị trống)**:
>     Nguyên nhân do **Cloud Build Service Agent** của dự án chưa có quyền đọc Token từ Developer Connect. Đảm bảo bạn đã chạy lệnh cấp quyền **C** ở **Mục 1**:
>     ```bash
>     PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")
>     gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
>         --member="serviceAccount:service-${PROJECT_NUM}@gcp-sa-cloudbuild.iam.gserviceaccount.com" \
>         --role="roles/developerconnect.tokenAccessor" \
>         --condition=None
>     ```
>     Sau đó **F5 reload** lại trang tạo Trigger.
> 
> *   **Trường hợp 2: Cảnh báo màu cam về quyền `developerconnect.readTokenAccessor` và không tìm thấy tài khoản mặc định `@cloudbuild.gserviceaccount.com` trong dropdown**:
>     *   **Lý do không thấy `@cloudbuild.gserviceaccount.com`**: Tài khoản cũ đó là tài khoản do Google quản lý (Google-managed), nên các trang Console mới của Cloud Build không cho phép chọn trực tiếp từ dropdown nữa.
>     *   **Giải pháp bảo mật (Khuyên dùng)**: Thay vì dùng tài khoản Compute Engine mặc định có quyền quá rộng (Editor), bạn hãy làm theo **Mục 1** ở trên để tạo tài khoản **`socialhub-build-sa`**. Tài khoản này là tài khoản do bạn tự quản lý (User-managed) nên sẽ **hiển thị trong dropdown** để bạn chọn. Khi chọn tài khoản này, bạn sẽ không gặp lỗi phân quyền vì bước 1 đã cấp đủ quyền `readTokenAccessor` cho nó.
>     *   **Giải pháp chữa cháy nhanh**: Nếu bạn vẫn muốn dùng Compute Engine mặc định (`...-compute@developer.gserviceaccount.com`), chỉ cần bấm nút **"Grant all"** ngay trên giao diện cảnh báo để Google Cloud tự cấp quyền `readTokenAccessor` cho nó. Hoặc chạy lệnh CLI:
>         ```bash
>         PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")
>         gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
>             --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
>             --role="roles/developerconnect.readTokenAccessor" \
>             --condition=None
>         ```

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

### 5. Cách hoạt động chạy thường ngày:

Vì bạn đã **push code trước khi tạo Trigger và kết nối Developer Connect**, nên sự kiện push đó sẽ không tự động kích hoạt build (vì lúc đó Trigger chưa tồn tại để bắt sự kiện).

Tuy nhiên, lúc này bạn đã cấu hình xong Trigger và cũng đã bật tính năng **Require Approval (Yêu cầu phê duyệt)**, bạn có 2 cách để bắt đầu chạy build đầu tiên:

---

#### Cách A: Kích hoạt chạy thủ công trên GCP Console (Nhanh nhất)
Bạn không cần push lại code, chỉ cần chạy trigger có sẵn bằng cách:
1.  Truy cập vào trang **Cloud Build** -> chọn tab **Triggers**.
2.  Tìm trigger `socialhub-github-trigger` và click nút **Run** (Chạy) ở góc phải.
3.  Chọn nhánh chạy là **`main`** (hoặc `master` tùy repo của bạn) -> click **Run Trigger**.
4.  Ngay sau đó, bạn chuyển sang tab **History (Lịch sử)** bên tay trái. Bạn sẽ thấy một bản build mới được tạo ra ở trạng thái **Pending (Đang chờ duyệt)** (màu vàng có biểu tượng ổ khóa).
5.  Click vào bản build đó -> Click nút **Approve (Phê duyệt)** ở góc trên -> Chọn **Approve** lần nữa để xác nhận. Bản build sẽ bắt đầu chạy thực tế.

---

#### Cách B: Push một commit mới lên GitHub (Tự động kích hoạt)
Bạn có thể tạo một commit trống để tạo sự kiện push mới lên GitHub:
1.  Mở terminal tại thư mục dự án và chạy:
    ```bash
    git commit --allow-empty -m "ci: trigger first cloud build pipeline"
    git push origin main
    ```
2.  Sau khi push thành công, bạn quay lại trang **Cloud Build** -> chọn tab **History (Lịch sử)**.
3.  Bạn cũng sẽ thấy bản build tự động xuất hiện ở trạng thái **Pending (Đang chờ duyệt)**. Click vào đó và chọn **Approve** tương tự như trên để chạy!

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
    --role="roles/artifactregistry.writer" \
    --condition=None

# Triển khai và quản lý tài nguyên trên cụm GKE
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com" \
    --role="roles/container.developer" \
    --condition=None
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

### 5. Cấu hình GitHub Variables
Để bảo mật, bạn không cần sửa trực tiếp tệp workflow YAML. Thay vào đó, hãy cấu hình các biến trực tiếp trên GitHub:

1. Vào Repository của bạn trên GitHub -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Chọn tab **Variables** (ở bên cạnh Secrets) -> click **New repository variable** và thêm lần lượt các biến sau:
   *   `GCP_PROJECT_ID`: `socialhub-micro-service-1`
   *   `GCP_REGION`: `asia-east1`
   *   `GAR_REPOSITORY`: `socialhub-repo`
   *   `GKE_CLUSTER`: `socialhub-gke-cluster`
   *   `WIF_PROVIDER`: Điền giá trị đầy đủ (ví dụ: `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/socialhub-wif-pool/providers/socialhub-github-provider`, thay `PROJECT_NUMBER` bằng số dự án của bạn).
   *   `WIF_SERVICE_ACCOUNT`: `socialhub-github-sa@socialhub-micro-service-1.iam.gserviceaccount.com`

### 6. Cách kích hoạt chạy thử nghiệm & Xác minh
Bạn chỉ cần thực hiện commit code và push trực tiếp lên branch `main`:
```bash
git add .
git commit -m "feat: setup GitHub Actions CI/CD with GKE Spot VMs and RabbitMQ"
git push origin main
```
Sau đó, truy cập tab **Actions** trên GitHub để theo dõi 7 máy ảo GitHub chạy song song (matrix build) để build Docker và tự động deploy lên cụm GKE.

**Kiểm tra RabbitMQ và các dịch vụ trong cụm GKE:**
Sau khi deploy thành công, hãy kiểm tra xem RabbitMQ đã chạy ổn định chưa để đảm bảo các dịch vụ realtime không bị lỗi kết nối:
```bash
# Kiểm tra các Pod xem rabbitmq đã chạy thành công chưa
kubectl get pods -n default

# Xem log kết nối của notification-service để chắc chắn đã kết nối thành công tới rabbitmq
kubectl logs deployment/notification-service -n default
```

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
