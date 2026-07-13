# Stage 1: Build React static assets
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve React assets using Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Injects routing rule for Single Page Application routing (React Router fallback)
RUN echo "server { listen 3000; location / { root /usr/share/nginx/html; index index.html; try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
