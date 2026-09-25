#!/usr/bin/env bash
# Apply VECTRACOM SQL migrations in order (idempotent).
# Usage: ./scripts/apply-migrations.sh [container_name]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${1:-vectracom-postgres}"
MIG_DIR="$ROOT/infra/postgres/migrations"

echo "=== Apply migrations → $CONTAINER ==="

run_sql() {
  local file="$1"
  local size
  size=$(wc -c < "$file" | tr -d ' ')
  if [ "$size" -eq 0 ]; then
    echo "  skip (empty): $(basename "$file")"
    return 0
  fi
  echo "  apply: $(basename "$file")"
  docker exec -i "$CONTAINER" psql -U vectracom -d vectracom -v ON_ERROR_STOP=0 < "$file" >/tmp/vectracom-mig.out 2>&1 || true
  # Ignore "already exists" noise; fail on unexpected errors
  if grep -qiE 'ERROR:.*(syntax|permission|fatal)' /tmp/vectracom-mig.out; then
    echo "  !! errors in $(basename "$file"):"
    grep -i error /tmp/vectracom-mig.out | head -20
    return 1
  fi
}

# Extensions first
if [ -f "$ROOT/infra/postgres/init.sql" ]; then
  run_sql "$ROOT/infra/postgres/init.sql"
fi

# Ordered real migrations (prefer drift files over empty stubs)
for f in \
  "$MIG_DIR/001_initial_schema.sql" \
  "$MIG_DIR/002_schema_drift_kpi_partners.sql" \
  "$MIG_DIR/003_schema_drift_stock_compliance.sql" \
  "$MIG_DIR/004_field_report_sav.sql" \
  "$MIG_DIR/005_admin_accounts.sql"
do
  if [ -f "$f" ]; then
    run_sql "$f"
  else
    echo "  missing: $f"
    exit 1
  fi
done

echo "=== Migrations done ==="
