#!/usr/bin/env bash
# Daily database backup. Add to cron:  0 2 * * * bash /opt/mukkani-crm/deploy/backup.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
docker compose exec -T db pg_dump -U mukkani mukkani | gzip > "backups/mukkani-$(date +%F).sql.gz"
find backups -name '*.sql.gz' -mtime +30 -delete
