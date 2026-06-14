#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/apps/shoe-store"
BACKEND="$APP/backend"
CUSTOMER_FRONTEND="$APP/frontend_user"
PYTHON="$ROOT/.venv/Scripts/python.exe"

if [[ ! -x "$PYTHON" ]]; then
  PYTHON="python"
fi

SKIP_INSTALL="${SKIP_INSTALL:-0}"

if [[ "$SKIP_INSTALL" != "1" ]]; then
  echo "Installing backend dependencies..."
  "$PYTHON" -m pip install -r "$BACKEND/requirements.txt"

  if [[ ! -d "$CUSTOMER_FRONTEND/node_modules" ]]; then
    echo "Installing customer frontend dependencies..."
    (cd "$CUSTOMER_FRONTEND" && npm install)
  fi
fi

echo "Starting Shoe Store services..."
echo "Backend API:        http://127.0.0.1:5000"
echo "Admin frontend:    http://127.0.0.1:3000"
echo "Customer frontend: http://127.0.0.1:3001"

pids=()

cleanup() {
  echo
  echo "Stopping services..."
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

(
  cd "$BACKEND"
  API_HOST=0.0.0.0 API_PORT=5000 "$PYTHON" app.py
) &
pids+=("$!")

(
  cd "$APP"
  UI_HOST=0.0.0.0 UI_PORT=3000 API_URL=http://127.0.0.1:5000 npm start
) &
pids+=("$!")

(
  cd "$CUSTOMER_FRONTEND"
  npm run dev -- --hostname 0.0.0.0 --port 3001
) &
pids+=("$!")

wait
