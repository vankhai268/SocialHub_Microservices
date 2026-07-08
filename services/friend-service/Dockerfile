# Bước 1: Sử dụng node image alpine siêu nhẹ
FROM node:18-alpine

# Bước 2: Thiết lập thư mục làm việc trong container
WORKDIR /usr/src/app

# Bước 3: Sao chép package.json
COPY package*.json ./

# Bước 4: Cài đặt production dependencies
RUN npm install --omit=dev

# Bước 5: Sao chép mã nguồn
COPY . .

# Bước 6: Mở cổng mặc định trong container
ENV PORT=5000
EXPOSE 5000

# Bước 7: Khởi chạy
CMD ["node", "src/index.js"]
