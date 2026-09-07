#!/usr/bin/env bash
# VECTRACOM Phase 1 — test de bout en bout du socle
# Usage : bash backend/test/e2e/phase1-smoke.sh
set -u
API="http://localhost:3100/api/v1"
PASS=0; FAIL=0

check() { # check <attendu> <obtenu> <libellé>
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $3"; else FAIL=$((FAIL+1)); echo "FAIL  $3 (attendu=$1 obtenu=$2)"; fi
}

code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

# --- 1. Health (public)
check 200 "$(code $API/health)" "GET /health public → 200"

# --- 2. Accès protégé sans JWT → 401
check 401 "$(code $API/auth/me)" "GET /auth/me sans token → 401"

# --- 3. Login super_admin
LOGIN=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@green-t.sn","password":"ChangeMe!2026"}')
GT=$(echo "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$GT" ] && { PASS=$((PASS+1)); echo "PASS  login super_admin"; } || { FAIL=$((FAIL+1)); echo "FAIL  login super_admin"; }

# --- 4. Mauvais mot de passe → 401
check 401 "$(code -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@green-t.sn","password":"WrongPass!99"}')" "login mauvais mot de passe → 401"

# --- 5. Création tenant ONECOMIT (register, réservé console)
REG=$(curl -s -X POST $API/auth/register -H "Content-Type: application/json" -H "Authorization: Bearer $GT" \
  -d '{"companyName":"ONECOMIT","sonatelSubcontractorName":"3STB","adminEmail":"admin@onecomit.sn","adminPassword":"Onecomit!2026","adminFullName":"Admin ONECOMIT"}')
CID=$(echo "$REG" | sed -n 's/.*"company":{"id":"\([^"]*\)".*/\1/p')
[ -n "$CID" ] && { PASS=$((PASS+1)); echo "PASS  création tenant ONECOMIT ($CID)"; } || { FAIL=$((FAIL+1)); echo "FAIL  création tenant ONECOMIT"; }

# --- 6. Console : liste des tenants
check 200 "$(code $API/tenants -H "Authorization: Bearer $GT")" "GET /tenants (super_admin) → 200"

# --- 7. Login admin du tenant
TL=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@onecomit.sn","password":"Onecomit!2026"}')
TT=$(echo "$TL" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$TT" ] && { PASS=$((PASS+1)); echo "PASS  login admin ONECOMIT"; } || { FAIL=$((FAIL+1)); echo "FAIL  login admin ONECOMIT"; }

# --- 8. /auth/me admin tenant
ME=$(curl -s $API/auth/me -H "Authorization: Bearer $TT")
echo "$ME" | grep -q '"companyName":"ONECOMIT"' && { PASS=$((PASS+1)); echo "PASS  /auth/me → ONECOMIT"; } || { FAIL=$((FAIL+1)); echo "FAIL  /auth/me"; }

# --- 9. Sécurité rôle : admin tenant ne peut PAS créer de tenant (403)
check 403 "$(code -X POST $API/tenants -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' -d '{"companyName":"X","adminEmail":"x@x.sn","adminPassword":"Password!1","adminFullName":"X"}')" "POST /tenants par admin tenant → 403"

# --- 10. Sécurité rôle : admin tenant ne peut PAS register
check 403 "$(code -X POST $API/auth/register -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' -d '{"companyName":"Y","adminEmail":"y@y.sn","adminPassword":"Password!1","adminFullName":"Y"}')" "POST /auth/register par admin tenant → 403"

# --- 11. Blocage progressif : passage en retard_j20 → écriture bloquée, lecture OK
curl -s -o /dev/null -X PATCH $API/tenants/$CID/subscription-status -H "Authorization: Bearer $GT" -H "Content-Type: application/json" -d '{"status":"retard_j20"}'
check 200 "$(code $API/auth/me -H "Authorization: Bearer $TT")" "retard_j20 : GET /auth/me → 200 (lecture seule)"
check 403 "$(code -X POST $API/auth/register -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' -d '{"companyName":"Z","adminEmail":"z@z.sn","adminPassword":"Password!1","adminFullName":"Z"}')" "retard_j20 : écriture → 403"

# --- 12. Suspension J+30 : tout bloqué
curl -s -o /dev/null -X PATCH $API/tenants/$CID/subscription-status -H "Authorization: Bearer $GT" -H "Content-Type: application/json" -d '{"status":"suspendu"}'
check 403 "$(code $API/auth/me -H "Authorization: Bearer $TT")" "suspendu : GET → 403"

# --- 13. Réactivation et remise à l'état actif
curl -s -o /dev/null -X PATCH $API/tenants/$CID/subscription-status -H "Authorization: Bearer $GT" -H "Content-Type: application/json" -d '{"status":"active"}'
check 200 "$(code $API/auth/me -H "Authorization: Bearer $TT")" "réactivé : GET → 200"

# --- 14. Audit : des lignes ont été écrites
AUD=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM audit_logs")
[ "${AUD:-0}" -gt 0 ] && { PASS=$((PASS+1)); echo "PASS  audit_logs contient $AUD lignes"; } || { FAIL=$((FAIL+1)); echo "FAIL  audit_logs vide"; }

echo "---"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
