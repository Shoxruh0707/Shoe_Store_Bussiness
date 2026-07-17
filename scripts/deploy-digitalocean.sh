#!/usr/bin/env sh
set -eu

APP_DIR="${APP_DIR:-/opt/admin-shoe-store}"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo "Missing .env. Create it from .env.production.example before deploying." >&2
  exit 1
fi

docker compose config --quiet
docker compose pull mysql caddy || true
docker compose up -d --build --remove-orphans
docker compose ps
