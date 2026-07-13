# 1. Base image Node.js 20 Slim (Debian-based to avoid Alpine DNS bugs)
FROM node:20-slim

# 2. Install tini and openssl (required for Prisma client)
RUN apt-get update && apt-get install -y tini openssl && rm -rf /var/lib/apt/lists/*

# 3. Setup working directory
WORKDIR /app

# 4. Set directory ownership to non-root 'node' user for security
RUN chown -R node:node /app

USER node

# 5. Copy package files first to leverage Docker Cache layer
COPY --chown=node:node package*.json ./

# 6. Install production dependencies only (including prisma CLI)
RUN npm ci --omit=dev

# 7. Copy schema files & generate Prisma Client
COPY --chown=node:node prisma ./prisma
RUN npx prisma generate

# 8. Copy source code
COPY --chown=node:node src ./src

# 9. Set Node environment variables and limit V8 heap size to save RAM
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=128"
ENV PORT=5000

# 10. Expose internal port
EXPOSE 5000

# 11. Use tini as entrypoint
ENTRYPOINT ["/usr/bin/tini", "--"]

# 12. Run prisma db push to ensure database schema is up-to-date at startup, then run node index.js
CMD ["sh", "-c", "npx prisma db push && node src/index.js"]
