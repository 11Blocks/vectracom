#!/usr/bin/env bash
# Compare critical schema markers local (docker) vs optional remote dump file.
# Usage: ./scripts/audit-schema.sh
set -euo pipefail
CONTAINER="${1:-vectracom-postgres}"

echo "=== Schema audit ($CONTAINER) ==="
docker exec "$CONTAINER" psql -U vectracom -d vectracom -Atc "
SELECT 'tables='||COUNT(*) FROM pg_tables WHERE schemaname='public';
SELECT 'partners='||CASE WHEN EXISTS(SELECT 1 FROM pg_tables WHERE tablename='partners') THEN 'YES' ELSE 'NO' END;
SELECT 'company_settings='||CASE WHEN EXISTS(SELECT 1 FROM pg_tables WHERE tablename='company_settings') THEN 'YES' ELSE 'NO' END;
SELECT 'kpi_tco='||CASE WHEN EXISTS(SELECT 1 FROM pg_tables WHERE tablename='kpi_tco_inputs') THEN 'YES' ELSE 'NO' END;
SELECT 'kpi_mastery='||CASE WHEN EXISTS(SELECT 1 FROM pg_tables WHERE tablename='kpi_mastery_plans') THEN 'YES' ELSE 'NO' END;
SELECT 'kpi_family='||COUNT(*) FROM information_schema.columns WHERE table_name='sonatel_kpi_logs' AND column_name='family';
SELECT 'kpi_penalty_mode='||COUNT(*) FROM information_schema.columns WHERE table_name='sonatel_kpi_logs' AND column_name='penalty_mode';
SELECT 'stock_created_at='||COUNT(*) FROM information_schema.columns WHERE table_name='stock_levels' AND column_name='created_at';
SELECT 'stock_mov_updated='||COUNT(*) FROM information_schema.columns WHERE table_name='stock_movements' AND column_name='updated_at';
SELECT 'hab_domains='||COUNT(*) FROM information_schema.columns WHERE table_name='compliance_records' AND column_name='habilitation_domains';
SELECT 'sav_action='||COUNT(*) FROM information_schema.columns WHERE table_name='mission_field_reports' AND column_name='sav_action';
"

echo "=== Expected (VPS aligned) ==="
echo "tables>=54 partners=YES company_settings=YES kpi_tco=YES kpi_mastery=YES"
echo "kpi_family=1 kpi_penalty_mode=1 stock_created_at=1 stock_mov_updated=1 hab_domains=1 sav_action=1"
