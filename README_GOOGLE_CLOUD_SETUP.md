# Hướng Dẫn Từng Bước Thiết Lập Dự Án Trên Google Cloud Platform (GCP)

Tài liệu này hướng dẫn chi tiết từ số 0 để thiết lập môi trường, cấp quyền API và khởi tạo toàn bộ tài nguyên cần thiết cho hệ thống **SocialHub Microservices** trên dự án GCP của bạn.

---

## ⚙️ Thông Số Cấu Hình Mặc Định (Default Parameters)
-   **Project ID**: `socialhub-micro-service-1`
-   **Vùng địa lý (Region)**: `asia-east1` (Đài Loan - Vùng có độ trễ thấp nhất về Việt Nam)
-   **Mạng VPC**: `socialhub-vpc`
-   **Subnet**: `socialhub-subnet-asia`

---

## 🛠️ Bước 1: Cài Đặt & Cấu Hình Google Cloud CLI (gcloud)

Để điều khiển toàn bộ tài nguyên GCP từ dòng lệnh của máy tính cá nhân:
1.  **Tải xuống gcloud CLI**:
    *   Tải bản cài đặt tại: [https://cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install) và tiến hành cài đặt vào máy tính.
2.  **Đăng nhập tài khoản Google Cloud**:
    *   Mở Terminal/PowerShell và gõ lệnh:
        ```bash
        gcloud auth login
        ```
    *   Trình duyệt sẽ tự động mở ra. Đăng nhập bằng tài khoản Google mà bạn đã tạo dự án GCP.
3.  **Đặt Project mặc định cho các phiên làm việc**:
    ```bash
    gcloud config set project socialhub-micro-service-1
    ```
4.  **Đặt Region mặc định**:
    ```bash
    gcloud config set compute/region asia-east1
    ```

---

## 🔌 Bước 2: Kích Hoạt Các API Của Google Cloud (Enable APIs)

Mặc định, các dự án GCP mới tạo sẽ bị tắt toàn bộ API dịch vụ. Chạy lệnh sau để kích hoạt tất cả các API cần dùng cùng một lúc:

```bash
gcloud services enable \
    compute.googleapis.com \
    container.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    clouddeploy.googleapis.com \
    sqladmin.googleapis.com \
    redis.googleapis.com \
    secretmanager.googleapis.com \
    servicenetworking.googleapis.com
```
*(Đợi 2 - 3 phút để hệ thống GCP kích hoạt xong các cổng dịch vụ)*

---

## 🌐 Bước 3: Thiết Lập Mạng Nội Bộ Bảo Mật (VPC, NAT Gateway)

Để các pod của GKE và cơ sở dữ liệu có thể liên lạc nội bộ với nhau một cách an toàn và không bị lộ ra ngoài internet.

### 1. Tạo mạng VPC riêng:
```bash
gcloud compute networks create socialhub-vpc --subnet-mode=custom
```

### 2. Tạo Subnet nội bộ tại vùng `asia-east1`:
```bash
gcloud compute networks subnets create socialhub-subnet-asia --network=socialhub-vpc --region=asia-east1 --range=10.0.0.0/20 --enable-private-ip-google-access
```

### 3. Tạo Cloud NAT (Để các Pod private có thể tải thư viện ngoài internet nhưng không bị bên ngoài truy cập vào):
-   Tạo Cloud Router:
    ```bash
    gcloud compute routers create socialhub-router --network=socialhub-vpc --region=asia-east1
    ```
-   Tạo NAT Gateway:
    ```bash
    gcloud compute routers nats create socialhub-nat --router=socialhub-router --region=asia-east1 --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges
    ```

> ⚠️ **Lưu ý sửa lỗi (Troubleshooting - Lỗi 409 Already Exists)**:
> Nếu trước đó bạn đã lỡ tạo `socialhub-router` mà không chỉ định mạng (khiến nó nằm ở mạng `default`), bạn sẽ gặp lỗi `HTTPError 409`. Để dọn dẹp và đưa router về đúng mạng `socialhub-vpc`, hãy chạy chuỗi lệnh sau trước khi làm tiếp:
> ```bash
> # 1. Xóa NAT cũ bị gán sai
> gcloud compute routers nats delete socialhub-nat --router=socialhub-router --region=asia-east1 --quiet
> 
> # 2. Xóa Router cũ bị gán sai ở mạng default
> gcloud compute routers delete socialhub-router --region=asia-east1 --quiet
> 
> # 3. Tiến hành chạy lại 2 lệnh tạo Router và tạo NAT Gateway ở trên.
> ```

---


## 💾 Bước 4: Khởi Tạo Các Dịch Vụ Cơ Sở Dữ Liệu Managed

### 1. Cấp dải IP private cho kết nối Database (VPC Peering):
```bash
# Đăng ký dải IP nội bộ cho dịch vụ GCP
gcloud compute addresses create socialhub-private-ip-alloc --global --purpose=VPC_PEERING --addresses=10.128.0.0 --prefix-length=16 --network=socialhub-vpc

# Tạo kết nối Peer tới hạ tầng Database Google
gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com --ranges=socialhub-private-ip-alloc --network=socialhub-vpc
```

### 2. Tạo Google Cloud SQL for PostgreSQL (Tối ưu chi phí cho Dev):
Khởi tạo Postgres instance không gán IP công cộng, cấu hình đơn vùng (ZONAL) và tài nguyên vừa đủ để tiết kiệm chi phí:
```bash
gcloud beta sql instances create socialhub-db-postgres \
    --database-version=POSTGRES_16 \
    --edition=ENTERPRISE \
    --tier=db-custom-1-3840 \
    --region=asia-east1 \
    --availability-type=ZONAL \
    --network=projects/socialhub-micro-service-1/global/networks/socialhub-vpc \
    --no-assign-ip \
    --enable-google-private-path
```
*(Lưu ý: Nếu chạy Production, bạn nên đổi sang `--availability-type=REGIONAL` để có High Availability và nâng tier cấu hình lên).*

Kết quả:
```bash
Creating Cloud SQL instance for POSTGRES_16.. done.                                                                                                                                                                  
Created [https://sqladmin.googleapis.com/sql/v1beta4/projects/socialhub-micro-service-1/instances/socialhub-db-postgres].
NAME: socialhub-db-postgres
DATABASE_VERSION: POSTGRES_16
LOCATION: asia-east1-c
TIER: db-custom-1-3840
PRIMARY_ADDRESS: -
PRIVATE_ADDRESS: ...
STATUS: RUNNABLE
```


### 3. Tạo Google Cloud Memorystore for Redis (Tối ưu chi phí cho Dev):
Khởi tạo Redis với gói `BASIC` (đơn vùng) và dung lượng tối thiểu `1GB` để tiết kiệm chi phí (mặc định không có replication):
```bash
gcloud redis instances create socialhub-redis \
    --tier=BASIC \
    --size=1 \
    --region=asia-east1 \
    --network=socialhub-vpc \
    --connect-mode=private-service-access
```

### 4. Tạo Google Cloud Storage Bucket (Thay thế MinIO):
```bash
gcloud storage buckets create gs://socialhub-media-bucket-1 \
    --location=asia-east1 \
    --uniform-bucket-level-access
```

---

## ☸️ Bước 5: Khởi Tạo Cụm GKE Autopilot (Google Kubernetes Engine)

Dựng cụm Kubernetes chạy ở chế độ Autopilot và chế độ Node Private hoàn toàn bảo mật:
```bash
gcloud container clusters create-auto socialhub-gke-cluster \
    --region=asia-east1 \
    --network=socialhub-vpc \
    --subnetwork=socialhub-subnet-asia \
    --enable-private-nodes \
    --master-ipv4-cidr=172.16.0.0/28
```

Kết quả:
```bash
Creating cluster socialhub-gke-cluster in asia-east1... Cluster is being health-checked (Kubernetes Control Plane is healthy)...done.                                                                                
Created [https://container.googleapis.com/v1/projects/socialhub-micro-service-1/zones/asia-east1/clusters/socialhub-gke-cluster].
To inspect the contents of your cluster, go to: https://console.cloud.google.com/kubernetes/workload_/gcloud/asia-east1/socialhub-gke-cluster?project=socialhub-micro-service-1
kubeconfig entry generated for socialhub-gke-cluster.
NAME: socialhub-gke-cluster
LOCATION: asia-east1
MASTER_VERSION: 1.35.5-gke.1241004
MASTER_IP:
MACHINE_TYPE: ek-standard-8
NODE_VERSION: 1.35.5-gke.1241004
NUM_NODES: 3
STATUS: RUNNING
STACK_TYPE: IP..
```

---

## 🤖 Bước 6: Thiết Lập Kho Chứa Docker & Phân Quyền CI/CD (IAM Roles)

Để **Cloud Build** và **Cloud Deploy** có đủ quyền tự động đóng gói docker và triển khai bản cập nhật lên cụm GKE:

### 1. Tạo kho chứa Docker (Google Artifact Registry):
```bash
gcloud artifacts repositories create socialhub-repo \
    --repository-format=docker \
    --location=asia-east1 \
    --description="Docker repository for SocialHub"
```

### 2. Cấp quyền cho Tài khoản Dịch vụ Cloud Build (Cloud Build Service Account):
Lấy số ID dự án của bạn để xác định địa chỉ email Service Account mặc định:
```bash
# Lấy Project Number của dự án
PROJECT_NUM=$(gcloud projects describe socialhub-micro-service-1 --format="value(projectNumber)")

# Email Service Account Cloud Build có cấu trúc: [PROJECT_NUM]@cloudbuild.gserviceaccount.com
BUILD_SA="${PROJECT_NUM}@cloudbuild.gserviceaccount.com"

# A. Cấp quyền ghi ảnh Docker vào Artifact Registry
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/artifactregistry.writer"

# B. Cấp quyền chạy Pipeline Google Cloud Deploy
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/clouddeploy.releaser"

# C. Cấp quyền deploy ứng dụng vào cụm Kubernetes GKE
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/container.developer"

# D. Cấp quyền đọc cấu hình/mật khẩu trong Secret Manager
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/secretmanager.secretAccessor"

# E. Cấp quyền thao tác lưu trữ log và build artifacts trong Cloud Storage
gcloud projects add-iam-policy-binding socialhub-micro-service-1 \
    --member="serviceAccount:${BUILD_SA}" \
    --role="roles/storage.admin"
```

**Cần làm xong hết bước 1 -> 6 này**

---

## 🔐 Bước 7: Tạo Và Cấu Hình Khóa Bảo Mật (Secret Manager)

Tránh lưu các thông tin nhạy cảm như mật khẩu database, JWT_SECRET trực tiếp trong code:

1.  **Tạo khóa bí mật cho JWT**:
    ```bash
    # Khởi tạo Secret
    gcloud secrets create socialhub-jwt-secret --replication-policy="automatic"
    
    # Ghi đè giá trị bí mật
    echo -n "congdaojwttoken123" | gcloud secrets versions add socialhub-jwt-secret --data-file=-
    ```
2.  **Tạo mật khẩu cơ sở dữ liệu Postgres**:
    ```bash
    # Khởi tạo Secret
    gcloud secrets create socialhub-db-password --replication-policy="automatic"
    
    # Ghi đè giá trị mật khẩu Postgres
    echo -n "socialhub_secret" | gcloud secrets versions add socialhub-db-password --data-file=-
    ```

---

## 🚀 Hoàn Tất Thiết Lập!
Hạ tầng GCP của bạn đã sẵn sàng. Bước tiếp theo là cấu hình tệp pipeline `cloudbuild.yaml` trong mã nguồn và chạy lệnh kích hoạt build tự động để đẩy ứng dụng lên đám mây Google!

---

## 💵 Chiến Lược Tối Ưu Chi Phí Khi Phát Triển (Cost Optimization)

Hạ tầng đám mây nếu để chạy liên tục không sử dụng sẽ phát sinh chi phí hàng tháng khá lớn. Dưới đây là cách bạn có thể cấu hình tối ưu hoặc tạm dừng các dịch vụ khi không code:

### 1. Google Kubernetes Engine (GKE) Autopilot
*   **Giá thuê cụm (Cluster Management Fee)**: GKE thu phí quản lý là $0.10/giờ (~$73/tháng). Tuy nhiên, Google Cloud tặng **Free Tier credit $74.40/tháng** cho mỗi tài khoản, nghĩa là nếu bạn chỉ duy trì duy nhất 1 cụm GKE này, phí quản lý cụm sẽ **hoàn toàn miễn phí (0 USD)**.
*   **Chi phí tài nguyên VM (Node)**: GKE Autopilot chỉ tính tiền dựa trên lượng tài nguyên (CPU, RAM) mà các Pod đang chạy yêu cầu.
    *   **Tận dụng Spot Pods (Giảm 60-90% chi phí)**: Bạn có thể yêu cầu GKE chạy ứng dụng của mình trên các máy ảo Spot giá rẻ bằng cách thêm `nodeSelector` và `tolerations` vào các file deployment manifest `.yaml` của ứng dụng:
        ```yaml
        spec:
          nodeSelector:
            cloud.google.com/gke-spot: "true"
          tolerations:
          - key: "cloud.google.com/gke-spot"
            operator: "Equal"
            value: "true"
            effect: "NoSchedule"
        ```
    *   **Tạm dừng (Scale-to-Zero)**: Khi kết thúc ca làm việc và không cần test, hãy scale tất cả các Deployment của bạn về **0 replica** (ví dụ: `kubectl scale deployment auth-service --replicas=0`). Khi không có Pod nào chạy, GKE Autopilot sẽ thu hồi toàn bộ máy ảo và bạn sẽ **không tốn một đồng chi phí tài nguyên nào**.

### 2. Google Cloud SQL (PostgreSQL)
*   **Tạm dừng khi không dùng**: Cloud SQL tính tiền theo giờ hoạt động của instance độc lập với việc có kết nối hay không. Bạn có thể tạm dừng (Stop) instance qua dòng lệnh khi nghỉ để chỉ phải trả tiền lưu trữ disk rất nhỏ (không mất tiền CPU/RAM):
    *   **Tắt Database**:
        ```bash
        gcloud sql instances patch socialhub-db-postgres --activation-policy=NEVER
        ```
    *   **Bật lại Database**:
        ```bash
        gcloud sql instances patch socialhub-db-postgres --activation-policy=ALWAYS
        ```

### 3. Memorystore (Redis) và Cloud NAT
*   **Redis**: Memorystore không hỗ trợ tạm dừng. Giải pháp tiết kiệm là xóa đi khi không dùng lâu ngày và tạo lại (hoặc chuyển sang chạy Redis container ngay trong cụm GKE sử dụng Spot VM).
*   **Cloud NAT Gateway**: Có mức phí cố định khoảng ~$30/tháng để duy trì. Nếu bạn dừng code dự án trong vài tuần, nên xóa NAT Gateway và Cloud Router đi và chạy lại lệnh tạo khi cần thiết.

---

## 🧹 Hướng Dẫn Xóa Hoàn Toàn Tài Nguyên (Resource Cleanup)

Khi muốn kết thúc dự án hoặc dọn dẹp sạch sẽ toàn bộ tài nguyên trên tài khoản GCP để tránh bị trừ tiền ngoài ý muốn, hãy mở Cloud Shell và chạy các lệnh sau theo thứ tự (các tài nguyên phụ thuộc sẽ được xóa trước):

```bash
# 1. Xóa cụm GKE Autopilot (quá trình này mất khoảng 5-10 phút)
gcloud container clusters delete socialhub-gke-cluster --region=asia-east1 --quiet

# 2. Xóa cơ sở dữ liệu Cloud SQL
gcloud sql instances delete socialhub-db-postgres --quiet

# 3. Xóa Memorystore Redis
gcloud redis instances delete socialhub-redis --region=asia-east1 --quiet

# 4. Xóa NAT Gateway & Cloud Router
gcloud compute routers nats delete socialhub-nat --router=socialhub-router --region=asia-east1 --quiet
gcloud compute routers delete socialhub-router --region=asia-east1 --quiet

# Trước khi xóa VPC cần xem các cái phụ thuộc đã xóa được hết chưa
# Kiểm tra Cloud SQL
gcloud sql instances list

# Kiểm tra Memorystore Redis
gcloud redis instances list --region=asia-east1


# 5. Xóa VPC Peering và Mạng VPC
gcloud services vpc-peerings delete --network=socialhub-vpc --service=servicenetworking.googleapis.com --quiet

gcloud compute addresses delete socialhub-private-ip-alloc --global --quiet
gcloud compute networks subnets delete socialhub-subnet-asia --region=asia-east1 --quiet
gcloud compute networks delete socialhub-vpc --quiet

# => Vì 4 Lệnh trên dễ lỗi vì nhiều cái phụ thuộc.
# Xóa các cái ở dưới trước

# 5.1. Xóa Subnet trước
gcloud compute networks subnets delete socialhub-subnet-asia --region=asia-east1 --quiet

# 5.2. Xóa địa chỉ IP đã cấp phát
gcloud compute addresses delete socialhub-private-ip-alloc --global --quiet

# 5.3. Xóa mạng VPC (nó sẽ tự động ép xóa các liên kết peering liên quan nếu các tài nguyên đích đã mất)
gcloud compute networks delete socialhub-vpc --quiet


# 6. Xóa Cloud Storage Bucket
gcloud storage buckets delete gs://socialhub-media-bucket-1 --quiet

# 7. Xóa Artifact Registry (Kho chứa Docker)
gcloud artifacts repositories delete socialhub-repo --location=asia-east1 --quiet

# 8. Xóa Secret Manager
gcloud secrets delete socialhub-jwt-secret --quiet
gcloud secrets delete socialhub-db-password --quiet
```
