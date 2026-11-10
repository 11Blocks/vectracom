#!/usr/bin/env bash
# VECTRACOM — réaligne les données démo sur le VPS puis affiche des compteurs.
# Usage (sur le VPS) : ADMIN_PASSWORD='…' bash scripts/vps-apply-align-data.sh
# Le mot de passe de admin@onecomit.sn n'est jamais écrit dans ce fichier.
set -e
if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "ERREUR : définir ADMIN_PASSWORD (mot de passe de admin@onecomit.sn) avant de lancer ce script." >&2
  exit 1
fi
cd /mnt/data/apps/Vectracom
cat scripts/align-demo-data.sql | docker exec -i vectracom-postgres psql -U vectracom -d vectracom
LOGIN_BODY=$(python3 -c 'import json,os; print(json.dumps({"email": "admin@onecomit.sn", "password": os.environ["ADMIN_PASSWORD"]}))')
TOKEN=$(curl -sS -X POST http://127.0.0.1:3100/api/v1/auth/login -H 'Content-Type: application/json' -d "$LOGIN_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')
echo VPS_COUNTS
docker exec vectracom-postgres psql -U vectracom -d vectracom -Atc "SELECT 'partners='||COUNT(*) FROM partners; SELECT 'company_settings='||COUNT(*) FROM company_settings; SELECT 'compliance_records='||COUNT(*) FROM compliance_records; SELECT 'compliance_docs='||COUNT(*) FROM company_compliance_documents; SELECT 'geopositions='||COUNT(*) FROM geopositions; SELECT 'geo_sub='||COUNT(*) FROM company_subscriptions WHERE plan_code='GEOLOCATION' AND status='active';"
echo VPS_API
curl -sS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3100/api/v1/geolocation/status; echo
curl -sS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3100/api/v1/geolocation/live | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get("markers",[])))';
curl -sS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3100/api/v1/partners | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))';
curl -sS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3100/api/v1/compliance/records | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))';
curl -sS -H "Authorization: Bearer $TOKEN" http://127.0.0.1:3100/api/v1/compliance/documents | python3 -c 'import sys,json; print(len(json.load(sys.stdin)))';