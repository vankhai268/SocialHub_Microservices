-- Tạo DB riêng cho post-service
CREATE DATABASE socialhub_post;

-- Bật uuid-ossp cho cả 2 DB
\c socialhub
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

\c socialhub_post
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
