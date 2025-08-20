# Trilio Photo Gallery — small, fast app image (no MySQL client inside)
FROM node:20-alpine

ENV NODE_ENV=production \
    PORT=8080 \
    MEDIA_DIR=/data/media

WORKDIR /app

# Install only prod deps; works with or without a lockfile
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Copy the rest of the app
COPY . .

# OpenShift-friendly perms: allow random non-root UID to read/write
RUN mkdir -p /data/media \
 && chown -R 0:0 /app /data \
 && chmod -R g=u /app /data

# Run as non-root inside the container
USER 10001

EXPOSE 8080
CMD ["node", "server.js"]
