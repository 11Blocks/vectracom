#!/usr/bin/env bash
# VECTRACOM — Démarrage aligné VPS (compose + migrations 001–004)
set -euo pipefail
cd "$(dirname "$0")"

echo "=== VECTRACOM — Démarrage (aligné VPS) ==="

echo "[1/5] PostgreSQL + Redis..."
docker compose up -d postgres redis
echo "      En attente de PostgreSQL..."
until docker exec vectracom-postgres pg_isready -U "${POSTGRES_USER:-vectracom}" -q 2>/dev/null; do
  sleep 2
done
echo "      OK"

echo "[2/5] Migrations SQL (001 + drift 002–004)..."
bash scripts/apply-migrations.sh vectracom-postgres
bash scripts/audit-schema.sh vectracom-postgres

echo "[3/5] Backend NestJS (host)..."
cd backend
if ! curl -sf http://localhost:3100/api/v1/health >/dev/null 2>&1; then
  # Prod-like by default for alignment; set TYPEORM_SYNCHRONIZE=true to opt into sync
  export TYPEORM_SYNCHRONIZE="${TYPEORM_SYNCHRONIZE:-false}"
  npx ts-node --transpile-only src/main.ts > /tmp/vectracom-api.log 2>&1 &
  echo "      PID: $!"
  sleep 10
fi
if curl -sf http://localhost:3100/api/v1/health | grep -q '"ok"'; then
  echo "      OK — http://localhost:3100/api/v1"
else
  echo "      ATTENTION : vérifiez /tmp/vectracom-api.log"
fi

echo "[4/5] Seeds..."
npx ts-node --transpile-only scripts/seed-all.ts 2>&1 | tail -5
npx ts-node --transpile-only scripts/ensure-onecomit-admin.ts 2>&1 | tail -5

echo "[5/5] KPI recalculate (best-effort)..."
TOKEN=$(curl -sf -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@onecomit.sn","password":"ChangeMe!2026"}' \
  | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p') || true
if [ -n "${TOKEN:-}" ]; then
  curl -sf -X POST "http://localhost:3100/api/v1/kpi-sonatel/recalculate?period=$(date +%Y-%m)" \
    -H "Authorization: Bearer $TOKEN" | head -c 200
  echo
else
  echo "      skip KPI (login ONECOMIT impossible)"
fi

echo ""
echo "=== VECTRACOM démarré ==="
echo "  API     : http://localhost:3100/api/v1"
echo "  Web     : http://localhost:3101 (compose) ou :3001 (npm)"
echo "  Audit   : bash scripts/audit-schema.sh"
