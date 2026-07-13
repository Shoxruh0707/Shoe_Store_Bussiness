# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS frontend-deps
WORKDIR /app/frontend
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=10000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000
COPY frontend/package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS frontend-build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=frontend-deps /app/frontend/node_modules ./frontend/node_modules
COPY frontend ./frontend
WORKDIR /app/frontend
RUN npm run build

FROM node:22-bookworm-slim AS backend
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-deps /app/node_modules ./node_modules
COPY server.js package*.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /app/public/uploads && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["npm", "start"]

FROM node:22-bookworm-slim AS frontend
WORKDIR /app/frontend
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=frontend-build /app/frontend/.next ./.next
COPY --from=frontend-build /app/frontend/public ./public
COPY --from=frontend-build /app/frontend/package*.json ./
COPY --from=frontend-deps /app/frontend/node_modules ./node_modules
RUN chown -R node:node /app
USER node
EXPOSE 3001
CMD ["npm", "start"]

FROM backend AS bot
CMD ["npm", "run", "bot"]
