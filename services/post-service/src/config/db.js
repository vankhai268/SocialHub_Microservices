import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DATABASE || 'socialhub',
    user: process.env.PG_USER || 'socialhub',
    password: process.env.PG_PASSWORD || 'socialhub_secret',
});

// SQL for initializing tables
const initDbSql = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL,
    content TEXT,
    media_ids VARCHAR(255)[] DEFAULT '{}',
    visibility VARCHAR(20) DEFAULT 'friends',
    is_shared BOOLEAN DEFAULT false,
    original_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    like_count INT DEFAULT 0,
    comment_count INT DEFAULT 0,
    share_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(post_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
  CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
  CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

  -- Migration for existing table
  ALTER TABLE posts ALTER COLUMN media_ids TYPE VARCHAR(255)[] USING media_ids::VARCHAR(255)[];
`;

export const initDatabase = async () => {
    let client;
    try {
        client = await pool.connect();
        console.log('🔌 Connecting to PostgreSQL to initialize database for post-service...');

        // Create tables
        await client.query(initDbSql);
        console.log('✅ Database tables initialized successfully for post-service!');

    } catch (error) {
        console.error('❌ Error connecting or initializing database:', error);
        process.exit(1);
    } finally {
        if (client) client.release();
    }
};

export default pool;
