# Bước 1: Sử dụng node image bản nhẹ (alpine) làm base image
FROM node:18-alpine

# Bước 2: Thiết lập thư mục làm việc bên trong container
WORKDIR /usr/src/app

# Bước 3: Sao chép file package.json và package-lock.json để cài đặt thư viện
COPY package*.json ./

# Bước 4: Cài đặt các thư viện phụ thuộc (chỉ cài production dependencies)
RUN npm install --omit=dev

# Bước 5: Sao chép toàn bộ mã nguồn vào container (trừ các file trong .dockerignore)
COPY . .

# Bước 6: Thiết lập cổng mặc định mà service sẽ chạy trong container
ENV PORT=5000
EXPOSE 5000

# Bước 7: Lệnh khởi chạy ứng dụng khi container bắt đầu chạy
CMD ["node", "src/index.js"]
