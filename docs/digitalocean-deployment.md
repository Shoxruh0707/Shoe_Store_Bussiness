# DigitalOcean Production Deployment

This deployment runs all services on one Ubuntu Droplet:

- Caddy reverse proxy with automatic HTTPS
- Next.js frontend
- Express backend
- Telegram long-polling bot
- Python/rembg image processor
- PostgreSQL

Only TCP ports 80 and 443 are published by Docker. PostgreSQL and application
ports remain private to the Compose network.

## 1. Create the Droplet

Use an Ubuntu 24.04 Droplet with Docker Engine and Docker Compose. DigitalOcean's
Docker 1-Click image is the simplest option. A minimum of 2 vCPUs and 4 GB RAM is
recommended because the image-processing model and frontend build require more
memory than a small 1 GB Droplet normally provides.

Attach a DigitalOcean Cloud Firewall with these inbound rules:

- SSH / TCP 22 from your own IP address
- HTTP / TCP 80 from all IPv4 and IPv6 addresses
- HTTPS / TCP 443 from all IPv4 and IPv6 addresses

Allow outbound traffic so Docker can download packages, Caddy can obtain TLS
certificates, and the bot can reach `api.telegram.org`.

## 2. Configure DNS

Create an `A` record for the chosen hostname, such as
`inventory.example.com`, pointing to the Droplet's public IPv4 address. Wait for
the record to resolve before starting Caddy, otherwise certificate issuance will
fail.

Verify from your computer:

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

Create the ignored production environment file:

```bash
cp .env.production.example .env.production
nano .env.production
chmod 600 .env.production
```

Set all placeholder values. In particular:

- `DOMAIN` is only the hostname, without `https://` or a trailing slash.
- `ACME_EMAIL` is used for certificate account notifications.
- `DB_PASSWORD` and `POSTGRES_PASSWORD` must be identical.
- `SESSION_SECRET` must be a long random secret.
- `TELEGRAM_BOT_TOKEN` must be the current token from BotFather.
- `TELEGRAM_BOT_USERNAME` must not include `@`.

Generate a session secret with:

```bash
openssl rand -hex 32
```

If a Telegram bot token was ever committed, pasted into logs, or otherwise
shared, revoke it with BotFather and use a new token before deployment.

## 5. Build and Start Everything

Validate the rendered Compose configuration without printing its secret values:

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  config --quiet
```

Build and start every service, including the bot:

```bash
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  up -d --build
```

The first image-processor build downloads the Python dependencies and caches the
`u2net` model, so it can take several minutes.

Check status and logs:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs -f --tail=100
```

When the stack is healthy, verify:

```bash
curl --fail --show-error https://inventory.example.com/api/health
```

The expected response is `{"ok":true}`.

## 6. Telegram Configuration

The production Compose file automatically gives the bot this Mini App URL:

```text
https://DOMAIN/inventory
```

Configure the same HTTPS domain for the bot in BotFather if Telegram requests an
allowed Mini App domain. Do not run a second copy of this bot with the same token;
only one long-polling process should consume updates.

## Updating

```bash
cd /opt/admin-shoe-store
git pull --ff-only
docker compose \
  --env-file .env.production \
  -f docker-compose.production.yml \
  up -d --build --remove-orphans
```

## PostgreSQL Backup

Create a database backup outside the container:

```bash
mkdir -p backups
docker compose --env-file .env.production -f docker-compose.production.yml \
  exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  > "backups/shoes-store-$(date +%F-%H%M%S).sql"
```

The named `postgres_data` and `uploads` volumes survive normal rebuilds and
container replacement. The initialization SQL runs only when `postgres_data` is
empty. Back up both the database and uploaded product images before destructive
volume operations.

## Useful Operations

```bash
# Restart one service
docker compose --env-file .env.production -f docker-compose.production.yml restart bot

# Follow bot logs
docker compose --env-file .env.production -f docker-compose.production.yml logs -f bot

# Stop without deleting persistent data
docker compose --env-file .env.production -f docker-compose.production.yml down
```

Never add `-v` to `docker compose down` unless you intentionally want to delete
the PostgreSQL, uploads, and Caddy certificate volumes.
