import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5434'),
    database: process.env.PG_DATABASE || 'socialhub_friend',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '123456',
});

const initDbSql = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS friend_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        from_user_id UUID NOT NULL,
        to_user_id UUID NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        -- Đảm bảo không gửi lời mời trùng lặp khi đang ở trạng thái pending
        CONSTRAINT unique_pending_request UNIQUE (from_user_id, to_user_id)
    );

    CREATE TABLE IF NOT EXISTS friendships (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        friend_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT unique_friendship UNIQUE (user_id, friend_id)
    );
`;

export const initDatabase = async () => {
    try {
        console.log("🔌 Đang kết nối tới PostgreSQL để khởi tạo database cho friend-service...");

        // Tạo bảng
        await pool.query(initDbSql);
        console.log("✅ Khởi tạo các bảng cơ sở dữ liệu cho friend-service thành công!");

    } catch (error) {
        console.error("❌ Lỗi khi khởi tạo database cho friend-service:", error.message);
        process.exit(1);
    }
}

export default pool;