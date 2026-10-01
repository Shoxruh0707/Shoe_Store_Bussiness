# Docker server deployment

This deployment runs MySQL 8.4, a one-shot schema migrator, the Node.js API, and Caddy on one Linux server. The same steps work on a DigitalOcean Ubuntu 24.04 Droplet or another Docker host.

## Server and network

Use at least 2 GB RAM. Install Docker Engine with the Compose plugin. Allow inbound SSH from trusted addresses and public TCP 80/443. Do not publish MySQL port 3306 or backend port 3000.

Point the deployment hostname's DNS `A` record to the server before starting Caddy.

## Configuration

```bash
git clone YOUR_REPOSITORY_URL /opt/admin-shoe-store
cd /opt/admin-shoe-store
cp .env.production.example .env
chmod 600 .env
nano .env
```

Replace every placeholder. Use different strong values for `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and `SESSION_SECRET`. `SESSION_SECRET` must contain at least 32 bytes. `PUBLIC_URL` must use the same HTTPS hostname served by Caddy.

## Back up before deployment

For an existing stack:

```bash
mkdir -p backups
docker compose exec -T mysql sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > "backups/shoes-store-$(date +%F-%H%M%S).sql"
docker run --rm -v admin-shoe-store_uploads:/source:ro -v "$PWD/backups:/backup" alpine tar -czf /backup/uploads-$(date +%F-%H%M%S).tar.gz -C /source .
```

Copy backups away from the server and test restoration before upgrading.

## Deploy

```bash
docker compose config --quiet
docker compose pull mysql caddy
docker compose up -d mysql
docker compose run --rm --build migrate
docker compose up -d --build --remove-orphans
docker compose ps
```

The helper performs the same sequence:

```bash
chmod +x scripts/deploy-digitalocean.sh
APP_DIR=/opt/admin-shoe-store scripts/deploy-digitalocean.sh
```

Verify:

```bash
curl --fail --show-error https://inventory.example.com/api/health
docker compose logs --tail=100 backend migrate caddy mysql
```

Expected health response: `{"ok":true}`.

## Persistent data

- `mysql_data`: database files
- `uploads`: product images
- `caddy_data`: TLS certificates and state
- `caddy_config`: Caddy runtime configuration

`docker compose down` keeps these volumes. Never add `-v` unless permanent deletion is intended and independently verified backups exist.

## Updates and rollback

```bash
cd /opt/admin-shoe-store
git pull --ff-only
scripts/deploy-digitalocean.sh
```

If the new API fails after a successful additive migration, deploy the previously tested compatible image while retaining the schema. If data or schema restoration is required, stop backend writers and follow the recovery process in [database migration operations](backend-migration-operations.md).
