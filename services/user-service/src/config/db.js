import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5433'),
    database: process.env.PG_DATABASE || 'socialhub_user',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '123456',
});


// SQL Khởi tạo bảng
const initDbSql = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    bio VARCHAR(500),
    avatar_url VARCHAR(2083),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

  ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url VARCHAR(2083);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ DEFAULT NOW();
`;

export const initDatabase = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('🔌 Đang kết nối tới PostgreSQL để khởi tạo database...');

        // 1. Tạo bảng
        await client.query(initDbSql);
        console.log('✅ Khởi tạo các bảng cơ sở dữ liệu thành công!');

        // 2. Chèn dữ liệu mẫu (Seeding)
        const userCountResult = await client.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(userCountResult.rows[0].count);
        if (userCount === 0) {
            console.log('🌱 Đang chèn dữ liệu mẫu (Seed accounts)...');
            const mockPass = await bcrypt.hash('123456', 10);

            const seedQuery = `
        INSERT INTO users (email, password_hash, display_name, bio) VALUES
        ('admin@socialhub.com', $1, 'Admin SocialHub', 'Tài khoản quản trị thử nghiệm'),
        ('testuser@socialhub.com', $1, 'Nguyễn Văn Test', 'Tài khoản người dùng thử nghiệm');
      `;
            await client.query(seedQuery, [mockPass]);
            console.log('🌱 Chèn dữ liệu mẫu thành công! (Tài khoản: admin@socialhub.com / testuser@socialhub.com, mật khẩu: 123456)');
        }
    } catch (error) {
        console.error('❌ Lỗi kết nối hoặc khởi tạo cơ sở dữ liệu:', error);
        process.exit(1);
    } finally {
        if (client) client.release();
    }
};


export default pool;
