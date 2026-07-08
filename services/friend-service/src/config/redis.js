import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: 3,
});

redis.on("connect", () => {
    console.log("⚡ Kết nối tới Redis thành công (friend-service)!");
});
redis.on("error", (err) => {
    console.error("❌ Lỗi kết nối Redis (friend-service):", err.message);
});
export default redis;
