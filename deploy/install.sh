#!/usr/bin/env bash
# First-time setup on an Ubuntu server with Docker.  Usage: bash deploy/install.sh crm.yourdomain.com
set -euo pipefail
DOMAIN="${1:?Give the domain, for example: bash deploy/install.sh crm.yourdomain.com}"
cd "$(dirname "$0")/.."
if ! command -v docker >/dev/null; then curl -fsSL https://get.docker.com | sh; fi
if [ ! -f .env ]; then
  ADMIN_PASSWORD="$(openssl rand -base64 12 | tr -d '/+=')"
  cat > .env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 24)
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_PASSWORD=$ADMIN_PASSWORD
APP_URL=https://$DOMAIN
SITE_ADDRESS=$DOMAIN
COOKIE_SECURE=true
ENV
  chmod 600 .env
  echo "Admin login: username admin, password $ADMIN_PASSWORD  (also saved in .env)"
fi
docker compose up -d --build
echo "Done. Open https://$DOMAIN"
