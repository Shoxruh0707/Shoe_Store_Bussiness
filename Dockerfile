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
COPY scripts ./scripts
COPY public ./public
RUN mkdir -p public/uploads public/uploads/temp && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "start"]

FROM backend AS bot
CMD ["npm", "run", "bot"]

FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
ARG BACKEND_API_URL=http://backend:3000/api
ENV BACKEND_API_URL=${BACKEND_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:22-alpine AS frontend
WORKDIR /app/frontend
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3001 \
    BACKEND_API_URL=http://backend:3000/api
COPY frontend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=frontend-build /app/frontend/.next ./.next
COPY --from=frontend-build /app/frontend/public ./public
COPY --from=frontend-build /app/frontend/next.config.mjs ./next.config.mjs
RUN chown -R node:node /app
USER node
EXPOSE 3001
CMD ["npm", "run", "start"]
