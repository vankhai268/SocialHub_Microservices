# post-service

> Content Management Service for SocialHub.

## Overview

- **Business Domain**: Posts, newsfeed, comments, likes, and shares.
- **Data Owned**: Posts content, visibility settings, interaction counters, comments, and likes.
- **Operations Exposed**: Create/update/delete posts, like/unlike, create/delete comments, share posts, and generate user feed.

## Tech Stack

| Component  | Choice             |
|------------|--------------------|
| Language   | Node.js (ESM)      |
| Framework  | Express.js         |
| Database   | PostgreSQL         |
| Cache      | Redis              |

## API Endpoints

| Method | Endpoint                            | Description                                          |
|--------|-------------------------------------|------------------------------------------------------|
| GET    | `/health`                           | Health check                                         |
| POST   | `/api/posts`                        | Create a new post                                    |
| GET    | `/api/posts/:id`                    | Get post by ID (includes author info)                |
| PUT    | `/api/posts/:id`                    | Update post (author only)                            |
| DELETE | `/api/posts/:id`                    | Delete post (author only)                            |
| GET    | `/api/posts/user/:userId`           | Get posts created by a specific user                 |
| GET    | `/api/feed`                         | Get global/personalized newsfeed (paginated)         |
| POST   | `/api/posts/:id/like`               | Like a post                                          |
| DELETE | `/api/posts/:id/like`               | Unlike a post                                        |
| GET    | `/api/posts/:id/comments`           | Get comments for a post (paginated)                  |
| POST   | `/api/posts/:id/comments`           | Create a comment on a post                           |
| DELETE | `/api/posts/:postId/comments/:id`   | Delete a comment (comment author or post author)     |
| POST   | `/api/posts/:id/share`              | Share a post                                         |

> Full API specification: [`docs/api-specs/post-service.yaml`](../../docs/api-specs/post-service.yaml)

## Running Locally

```bash
# From project root
docker compose up post-service --build
```

## Project Structure

```
post-service/
├── Dockerfile
├── package.json
├── readme.md
└── src/
    ├── config/       # Connection configurations (db, redis)
    ├── controllers/  # API business logic handlers (post, feed, like, comment, share)
    ├── middleware/   # Request interception (auth context extraction)
    ├── routes/       # Endpoint routing definitions
    └── utils/        # Utilities (standardized response, inter-service API calls)
```

## Environment Variables

| Variable             | Description                          | Default                               |
|----------------------|--------------------------------------|---------------------------------------|
| `PORT`               | Port of the service                  | 5000                                  |
| `PG_HOST`            | PostgreSQL database host             | localhost                             |
| `PG_PORT`            | PostgreSQL database port             | 5432                                  |
| `PG_DATABASE`        | PostgreSQL database name             | socialhub                             |
| `PG_USER`            | PostgreSQL username                  | socialhub                             |
| `PG_PASSWORD`        | PostgreSQL password                  | socialhub_secret                      |
| `REDIS_URL`          | Redis connection string              | redis://localhost:6379                |
| `USER_SERVICE_URL`   | Internal URL to user-service         | http://user-service:5000              |
| `MEDIA_SERVICE_URL`  | Internal URL to media-service        | http://media-service:5000             |
