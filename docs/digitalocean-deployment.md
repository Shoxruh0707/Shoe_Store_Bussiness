# DigitalOcean Docker Deployment

This deployment runs all services on one Ubuntu Droplet:

- Caddy reverse proxy with automatic HTTPS
- Next.js frontend
- Express backend
- Telegram long-polling bot
- MySQL 8.4

Only TCP ports 80 and 443 are published by Docker. MySQL and application ports
stay private inside the Compose network.

## 1. Create the Droplet

Use an Ubuntu 24.04 Droplet with Docker Engine and Docker Compose. DigitalOcean's
Docker 1-Click image is the simplest option. Use at least 2 GB RAM; 4 GB is more
comfortable when building the Next.js frontend.

Attach a DigitalOcean Cloud Firewall with these inbound rules:

- SSH / TCP 22 from your own IP address
- HTTP / TCP 80 from all IPv4 and IPv6 addresses
- HTTPS / TCP 443 from all IPv4 and IPv6 addresses

Allow outbound traffic so Docker can download images, Caddy can obtain TLS
certificates, and the bot can reach `api.telegram.org`.

## 2. Configure DNS

Create an `A` record for your hostname, such as `inventory.example.com`,
pointing to the Droplet's public IPv4 address. Wait for the DNS record to
resolve before starting Caddy.

```bash
nslookup inventory.example.com
```

## 3. Copy the Project

Connect to the Droplet and clone or copy the repository:

```bash
ssh root@DROPLET_IP
git clone YOUR_REPOSITORY_URL /opt/admin-shoe-store
cd /opt/admin-shoe-store
```

## 4. Configure Production Secrets

Create the ignored environment file:

```bash
cp .env.production.example .env
nano .env
chmod 600 .env
```

Set all placeholder values. Important notes:

- `DOMAIN` is only the hostname, without `https://` or a trailing slash.
- `CADDY_DOMAINS` is optional. Use it when Caddy should serve more than one
  hostname, for example `ombor.me, www.ombor.me`.
- To move this same project to another domain later, update DNS, change
  `DOMAIN` in `.env`, and restart the stack. No code change is needed.
- `ACME_EMAIL` is used by Caddy for Let's Encrypt.
- Keep `DB_NAME=shoes_store_db` unless you also edit `shoes_store_database_ddl.sql`.
- `DB_PASSWORD` is the app database user password.
- `MYSQL_ROOT_PASSWORD` should be a different strong password.
- `SESSION_SECRET` must be a long random secret.
- `TELEGRAM_BOT_TOKEN` must be the current token from BotFather.
- `TELEGRAM_BOT_USERNAME` must not include `@`.

Generate secrets with:

```bash
openssl rand -hex 32
```

If a Telegram bot token was ever committed, pasted into logs, or otherwise
shared, revoke it with BotFather and use a new token before deployment.

## 5. Build and Start

Validate the Compose configuration:

```bash
docker compose config --quiet
```

Build and start every service:

```bash
docker compose up -d --build
```

Or use the deploy helper:

```bash
chmod +x scripts/deploy-digitalocean.sh
APP_DIR=/opt/admin-shoe-store scripts/deploy-digitalocean.sh
```

Check status and logs:

```bash
docker compose ps
docker compose logs -f --tail=100
```

When the stack is healthy, verify:

```bash
curl --fail --show-error https://inventory.example.com/api/health
```

The expected response is:

```json
{"ok":true}
```

To verify background removal specifically:

```bash
docker compose exec backend /app/.venv/bin/python -c "import rembg; print('rembg ok')"
docker compose exec backend test -f /app/scripts/remove_background.py
curl --fail --show-error "https://inventory.example.com/api/health?debug=rembg"
```

If the backend logs say background removal is enabled but unavailable, check the
debug health response and the startup warning. In this Docker deployment,
`REMBG_PYTHON` should be `/app/.venv/bin/python` and `REMBG_SCRIPT` should be
`/app/scripts/remove_background.py`.

If you run the app directly on Ubuntu without Docker, do not use the `/app/...`
paths from the Docker example. From the project directory, create and use a
local venv instead:

```bash
sudo apt-get update
sudo apt-get install -y python3-venv libgomp1
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip setuptools wheel
.venv/bin/python -m pip install -r scripts/requirements-rembg.txt
```

Use these values in `.env` for direct Ubuntu runs:

```env
REMBG_ENABLED=true
REMBG_PYTHON=.venv/bin/python
REMBG_SCRIPT=scripts/remove_background.py
REMBG_TIMEOUT_MS=120000
```

## 6. Telegram Configuration

The bot uses this Mini App URL:

```text
https://DOMAIN/inventory
```

Configure the same HTTPS domain in BotFather if Telegram requests an allowed
Mini App domain. Do not run a second copy of this bot with the same token; only
one long-polling process should consume updates.

## Updating

```bash
cd /opt/admin-shoe-store
git pull --ff-only
scripts/deploy-digitalocean.sh
```

## MySQL Backup

Create a database backup outside the container:

```bash
mkdir -p backups
docker compose exec -T mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  > "backups/shoes-store-$(date +%F-%H%M%S).sql"
```

The named `mysql_data` and `uploads` volumes survive normal rebuilds and
container replacement. The initialization SQL runs only when `mysql_data` is
empty. Back up both the database and uploaded product images before destructive
volume operations.

## Useful Operations

```bash
# Restart one service
docker compose restart bot

# Follow bot logs
docker compose logs -f bot

# Stop without deleting persistent data
docker compose down
```

Never add `-v` to `docker compose down` unless you intentionally want to delete
the MySQL, uploads, and Caddy certificate volumes.
