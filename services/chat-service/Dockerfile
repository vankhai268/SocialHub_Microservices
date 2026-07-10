# Chat Service — Dockerfile
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl wget

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
