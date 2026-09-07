#!/usr/bin/env bash
# VECTRACOM — Démarrage complet
set -e
cd "$(dirname "$0")"

echo "=== VECTRACOM — Démarrage ==="

# 1. Infrastructure
echo "[1/4] PostgreSQL + Redis..."
docker compose up -d postgres redis
echo "      En attente de PostgreSQL..."
sleep 5
until docker exec vectracom-postgres pg_isready -U vectracom -q 2>/dev/null; do
  sleep 2
done
echo "      OK"

# 2. Migration initiale (premier démarrage)
echo "[2/4] Migration SQL..."
docker exec -i vectracom-postgres psql -U vectracom -d vectracom < infra/postgres/init.sql 2>/dev/null || true
docker exec -i vectracom-postgres psql -U vectracom -d vectracom < infra/postgres/migrations/001_initial_schema.sql 2>/dev/null || true
echo "      OK"

# 3. Backend
echo "[3/4] Backend NestJS..."
cd backend
npx ts-node --transpile-only src/main.ts > /tmp/vectracom-api.log 2>&1 &
API_PID=$!
echo "      PID: $API_PID"
sleep 8
if curl -s http://localhost:3100/api/v1/health | grep -q '"ok"'; then
  echo "      OK — http://localhost:3100/api/v1"
else
  echo "      ATTENTION : vérifiez /tmp/vectracom-api.log"
fi

# 4. Seeds (première fois uniquement)
echo "[4/4] Seeds..."
npx ts-node scripts/seed-all.ts 2>&1 | tail -3

echo ""
echo "=== VECTRACOM démarré ==="
echo "  API     : http://localhost:3100/api/v1"
echo "  Health  : http://localhost:3100/api/v1/health"
echo "  Console : admin@green-t.sn (voir .env)"
