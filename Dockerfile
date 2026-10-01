# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-bookworm-slim AS backend
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=backend-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY server.js ./
COPY src ./src
COPY scripts/migrate.js ./scripts/migrate.js
RUN mkdir -p public/uploads public/uploads/temp && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "start"]
