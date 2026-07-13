# 1. Base image Node.js 20 Slim (Debian-based to avoid Alpine DNS bugs)
FROM node:20-slim

# 2. Install tini for proper process management & signal forwarding
RUN apt-get update && apt-get install -y tini && rm -rf /var/lib/apt/lists/*

# 3. Setup working directory
WORKDIR /app

# 4. Set directory ownership to non-root 'node' user for security
RUN chown -R node:node /app

USER node

# 5. Copy package files first to leverage Docker Cache layer
COPY --chown=node:node package*.json ./

# 6. Install production dependencies only using npm ci
RUN npm ci --omit=dev

# 7. Copy source code
COPY --chown=node:node src ./src

# 8. Set Node environment variables and limit V8 heap size to save RAM
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=128"
ENV PORT=8000

# 9. Expose internal port
EXPOSE 8000

# 10. Use tini as entrypoint
ENTRYPOINT ["/usr/bin/tini", "--"]

# 11. Run node directly
CMD ["node", "src/server.js"]