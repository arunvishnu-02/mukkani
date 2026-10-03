#!/usr/bin/env bash
# Pull the latest code and restart. Migrations run automatically on start.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull
docker compose up -d --build
