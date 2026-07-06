# Getting Started — SocialHub

> Hướng dẫn setup và phát triển **SocialHub** — nền tảng mạng xã hội microservices.
> Sau khi hoàn thành setup, tài liệu dự án chính nằm ở [`README.md`](README.md).

---

## Prerequisites

- [Docker Desktop](https://docs.docker.com/get-docker/) (includes Docker Compose)
- [Git](https://git-scm.com/)
- [Node.js 18+](https://nodejs.org/) (for local development without Docker)
- An AI coding tool (recommended): [GitHub Copilot](https://github.com/features/copilot), [Cursor](https://cursor.sh), or [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/SocialHub_Microservices.git
cd SocialHub_Microservices

# 2. Initialize the project
cp .env.example .env

# 3. Build and run all services
docker compose up --build

# 4. Verify services are running
curl http://localhost:8080/health   # Gateway
curl http://localhost:5001/health   # user-service
curl http://localhost:5002/health   # friend-service
curl http://localhost:5003/health   # post-service
curl http://localhost:5004/health   # chat-service
curl http://localhost:5005/health   # media-service
curl http://localhost:5006/health   # notification-service
curl http://localhost:3000          # Frontend
```

### Using Make (optional)

```bash
make help      # Show all available commands
make init      # Initialize project
make up        # Build and start all services
make down      # Stop all services
make logs      # View logs
make clean     # Remove everything
```

---

## Project Structure

```
SocialHub_Microservices/
├── README.md                       # Project overview
├── GETTING_STARTED.md              # This file — setup & development guide
├── .env.example                    # Environment variable template
├── docker-compose.yml              # Multi-container orchestration (12 containers)
├── Makefile                        # Common development commands
│
├── docs/                           # Documentation
│   ├── analysis-and-design-ddd.md  # DDD analysis & design (completed)
│   ├── architecture.md             # Architecture patterns & deployment (completed)
│   ├── asset/                      # Images, diagrams, visual assets
│   └── api-specs/                  # OpenAPI 3.0 specifications
│       ├── user-service.yaml       # Auth, Profile, User search
│       ├── friend-service.yaml     # Friend requests, Friendship
│       ├── post-service.yaml       # Posts, Feed, Like, Comment, Share
│       ├── chat-service.yaml       # Messages, Groups, Socket.IO events
│       ├── media-service.yaml      # Upload, Presigned URL
│       └── notification-service.yaml # Notifications, Redis Pub/Sub consumer
│
├── frontend/                       # Frontend application (React + Vite)
│   ├── Dockerfile
│   ├── readme.md
│   └── src/
│
├── gateway/                        # API Gateway (Express)
│   ├── Dockerfile
│   ├── readme.md
│   └── src/
│
├── services/                       # Backend microservices (6 services)
│   ├── user-service/               # Identity & Access
│   │   ├── Dockerfile
│   │   ├── readme.md
│   │   └── src/
│   ├── friend-service/             # Social Graph
│   │   ├── Dockerfile
│   │   ├── readme.md
│   │   └── src/
│   ├── post-service/               # Content
│   │   ├── Dockerfile
│   │   ├── readme.md
│   │   └── src/
│   ├── chat-service/               # Messaging (Socket.IO)
│   │   ├── Dockerfile
│   │   ├── readme.md
│   │   └── src/
│   ├── media-service/              # Media (MinIO)
│   │   ├── Dockerfile
│   │   ├── readme.md
│   │   └── src/
│   └── notification-service/       # Notifications (Redis Pub/Sub)
│       ├── Dockerfile
│       ├── readme.md
│       └── src/
│
├── scripts/                        # Utility scripts
│   └── init.sh
│
└── .ai/                            # AI-assisted development
    ├── AGENTS.md
    ├── vibe-coding-guide.md
    └── prompts/
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React + Vite | SPA, Socket.IO client |
| **Gateway** | Node.js (Express) | Routing, JWT validation, rate limiting |
| **Backend** | Node.js (Express) × 6 | Microservices |
| **Realtime** | Socket.IO | Chat, notifications, typing, online presence |
| **Database** | PostgreSQL 16 | Users, posts, friendships (relational) |
| **Database** | MongoDB 7 | Messages, notifications (document) |
| **Cache** | Redis 7 | Feed cache, JWT blacklist, pub/sub, presence |
| **Storage** | MinIO | Images (S3-compatible, presigned URLs) |
| **Container** | Docker Compose | Orchestration |

---

## Recommended Workflow

> **Document flow:** Analysis & Design → Architecture → API Specs → Implementation

```
┌──────────────────────────────────────┐
│  Phase 1: Analysis & Design (DDD)    │  ✅ Completed
│  docs/analysis-and-design-ddd.md     │  6 Bounded Contexts → 6 services
│                                      │  30 events, 28 commands, 10 aggregates
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Phase 2: Architecture & API Design  │  ✅ Completed
│  docs/architecture.md                │  Patterns, components, deployment
│  docs/api-specs/*.yaml               │  6 OpenAPI specs
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Phase 3: Implementation             │  🔲 In Progress
│  services/ + gateway/ + frontend/    │  Code services inside Docker
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Phase 4: Documentation              │  🔲 Pending
│  & Finalization                      │  README, verify docker compose
└──────────────────────────────────────┘
```

### Phase 1: Analysis & Design ✅

- [x] Domain analysis using Domain-Driven Design approach
- [x] Ubiquitous Language glossary (20 terms)
- [x] Domain Events (30 events) and Commands (28 commands)
- [x] Aggregates (10 aggregates) and Bounded Contexts (6 contexts)
- [x] Context Map with upstream/downstream relationships
- [x] Service Composition sequence diagrams (5 flows)
- [x] Service contracts and logic design

### Phase 2: Architecture & API Design ✅

- [x] Pattern selection (API Gateway, Database per Service, Event-driven, CQRS partial, Circuit Breaker)
- [x] System Components table with tech stack and ports
- [x] Communication Matrix (REST, WebSocket, TCP, Pub/Sub)
- [x] C4 Architecture Diagrams (System Context + Container)
- [x] Docker Compose deployment configuration
- [x] OpenAPI specs for all 6 services
- [x] Socket.IO event documentation (chat-service, notification-service)
- [x] Redis Pub/Sub channel documentation

### Phase 3: Implementation

- [ ] Set up Node.js projects for each service (`npm init`)
- [ ] Implement `GET /health` in every service (do this first!)
- [ ] **user-service**: Auth (register, login, JWT), profile CRUD, user search
- [ ] **friend-service**: Friend requests, friendship management, suggestions
- [ ] **post-service**: Posts CRUD, feed (with Redis cache), like, comment, share
- [ ] **chat-service**: Socket.IO setup, conversations, groups, messages
- [ ] **media-service**: MinIO integration, file upload, presigned URL generation
- [ ] **notification-service**: Redis Pub/Sub consumer, Socket.IO push, notification CRUD
- [ ] **Gateway**: Express proxy routing, JWT middleware, rate limiting
- [ ] **Frontend**: React components, Socket.IO client, responsive UI
- [ ] Configure Dockerfiles for each service

### Phase 4: Documentation & Finalization

- [ ] Verify `docker compose up --build` works end-to-end
- [ ] Update [`README.md`](README.md) with final project details
- [ ] Update each service's `readme.md`

---

## Development Guidelines

### Service Communication

| Rule | Description |
|------|-------------|
| **Docker DNS** | Use service names: `http://user-service:5000`, NOT `localhost` |
| **Gateway only** | Frontend → Gateway → Service. Frontend never calls services directly |
| **Internal APIs** | Services call each other via internal endpoints (not through Gateway) |
| **JWT** | Gateway validates JWT. Services trust Gateway's forwarded user info |

### Database Ownership

| Service | Database | Schemas |
|---------|----------|---------|
| user-service | PostgreSQL | `users`, `profiles` |
| friend-service | PostgreSQL | `friend_requests`, `friendships` |
| post-service | PostgreSQL | `posts`, `likes`, `comments` |
| chat-service | MongoDB | `conversations`, `messages`, `groups` |
| media-service | — | `media_metadata` (PostgreSQL or in-memory) + MinIO |
| notification-service | MongoDB | `notifications` |

> ⚠️ **Database per Service**: Each service owns its data. Never access another service's database directly — use REST APIs.

### Redis Usage

| Use Case | Key Pattern | TTL | Service |
|----------|-------------|-----|---------|
| JWT Blacklist | `blacklist:{jti}` | Token remaining TTL | user-service |
| User Profile Cache | `user:{userId}` | 30 min | user-service |
| Friend List Cache | `friends:{userId}` | 15 min | friend-service |
| News Feed Cache | `feed:{userId}` | 10 min | post-service |
| Online Presence | `online:{userId}` | 5 min + heartbeat | chat-service |
| Rate Limiting | `ratelimit:{ip}:{endpoint}` | 1 min | Gateway |
| Socket.IO Adapter | (internal) | — | chat-service |
| Pub/Sub | `friend.*`, `post.*`, `message.*`, `group.*` | — | various → notification |

### MinIO (Presigned URL Security)

```
1. Client → Gateway: POST /api/media/upload (multipart + JWT)
2. Gateway → media-service: Forward file
3. media-service → MinIO: PutObject (private bucket)
4. Return mediaId to client

5. Client → Gateway: GET /api/media/:id/url (JWT required)
6. media-service → MinIO: GeneratePresignedURL (TTL=15min)
7. Return presigned URL to client

8. Client → MinIO: GET presigned URL (no auth needed)
9. After 15min → URL expired → 403 Forbidden
```

---

## Submission Checklist

- [ ] `README.md` updated with team info and service descriptions
- [ ] All services start with `docker compose up --build`
- [ ] Every service has a working `GET /health` endpoint
- [ ] Analysis & Design completed: [`docs/analysis-and-design-ddd.md`](docs/analysis-and-design-ddd.md)
- [ ] Architecture completed: [`docs/architecture.md`](docs/architecture.md)
- [ ] OpenAPI specs in `docs/api-specs/` match implementation
- [ ] Each service has its own `readme.md`
- [ ] Socket.IO messaging works (1-1 and group chat)
- [ ] Presigned URL security works (upload → get URL → access → expire)
- [ ] Redis caching works (feed, profile, friend list)
- [ ] Notifications are pushed realtime via Socket.IO
- [ ] Code is clean, organized, and follows Node.js conventions

---

## AI-Assisted Development (Vibe Coding)

This repo is pre-configured for AI-powered development:

| Tool | Config File |
|------|-------------|
| GitHub Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursorrules` |
| Claude Code | `CLAUDE.md` |

All config files point to [`.ai/AGENTS.md`](.ai/AGENTS.md) as the single source of truth.
Prompt templates: [`.ai/prompts/`](.ai/prompts/).

> Full guide: [`.ai/vibe-coding-guide.md`](.ai/vibe-coding-guide.md)

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `docker: command not found` | Docker Desktop not installed | Install from https://docs.docker.com/get-docker/ |
| `Cannot connect to Docker daemon` | Docker Desktop not running | Open Docker Desktop and wait for 🐳 icon |
| `port is already in use` | Port occupied | Stop that app or change port in `.env` |
| Service A cannot call Service B | Using `localhost` instead of service name | Change to `http://service-name:5000` |
| `ECONNREFUSED` to database | Service started before DB is ready | Docker Compose healthcheck handles this |
| MinIO 403 on presigned URL | URL expired (>15 min) | Request new presigned URL via `/api/media/:id/url` |
| Socket.IO connection failed | JWT missing in handshake | Pass JWT in `auth: { token: "Bearer ..." }` |
| `git push` rejected | Remote has unpulled changes | Run `git pull --rebase` then push again |

---


