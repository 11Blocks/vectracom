#!/usr/bin/env bash
# VECTRACOM — deploy code to VPS WITHOUT overwriting production runtime config.
#
# CRITICAL (TrackIT coexists on 83.228.222.179):
#   NEVER overwrite on VPS:
#     - docker-compose.yml  (ports 3100/3101/5434/6380, DNS vectracom-postgres, networks)
#     - .env / .env.prod / .deploy-credentials.txt
#   Host ports MUST stay: 3100, 3101, 5434, 6380 (never 3000/5433/6379/8080/…).
#
# Usage (from laptop, with SSH key):
#   bash scripts/deploy-vps.sh ubuntu@83.228.222.179 /mnt/data/apps/Vectracom
#
set -euo pipefail

REMOTE="${1:?usage: deploy-vps.sh user@host /remote/app/path}"
REMOTE_PATH="${2:?usage: deploy-vps.sh user@host /remote/app/path}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_OPTS="${SSH_OPTS:--o StrictHostKeyChecking=accept-new}"

echo "=== sync code → ${REMOTE}:${REMOTE_PATH}"
echo "=== EXCLUDED (do not overwrite VPS): docker-compose.yml, .env*, credentials"

rsync -a --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.dev' \
  --exclude '.env.prod' \
  --exclude '.env.local' \
  --exclude '.env.*.local' \
  --exclude '.deploy-credentials.txt' \
  --exclude 'docker-compose.yml' \
  --exclude 'backend/uploads' \
  --exclude 'node_modules' \
  --exclude 'backend/node_modules' \
  --exclude 'web-admin/node_modules' \
  --exclude 'mobile/node_modules' \
  --exclude 'web-admin/.next' \
  --exclude 'backend/dist' \
  --exclude '.expo' \
  -e "ssh ${SSH_OPTS}" \
  "${ROOT}/" "${REMOTE}:${REMOTE_PATH}/"

echo "=== done. Rebuild images on VPS with existing compose/env, e.g.:"
echo "  ssh ${REMOTE} 'cd ${REMOTE_PATH} && docker compose build backend web-admin && docker compose up -d backend web-admin'"
