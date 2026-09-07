#!/usr/bin/env bash
# VECTRACOM Phase 14 - Business & Platform Monitoring : test e2e
set -u
API="http://localhost:3100/api/v1"
PASS=0; FAIL=0

check() {
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $3"; else FAIL=$((FAIL+1)); echo "FAIL  $3 (attendu=$1 obtenu=$2)"; fi
}
jget() { node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]}console.log(v===undefined||v===null?'':String(v))" "$1" "$2"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

# Deux jetons : admin ONECOMIT (monitoring) + super_admin Green-T (business)
TT=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@onecomit.sn","password":"Onecomit!2026"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
GT=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@green-t.sn","password":"ChangeMe!2026"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
[ -n "$TT" ] && [ -n "$GT" ] && { PASS=$((PASS+1)); echo "PASS  logins ONECOMIT + Green-T"; } || { FAIL=$((FAIL+1)); echo "FAIL  logins"; }
AUTH="Authorization: Bearer $TT"
GTAUTH="Authorization: Bearer $GT"
J="Content-Type: application/json"

# ---------- Fixtures : nettoyage + socle SaaS deterministe ----------
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
DELETE FROM platform_monitoring_logs;
DELETE FROM saas_transactions; DELETE FROM saas_overage_bills; DELETE FROM invoices_saas;
DELETE FROM company_subscriptions; DELETE FROM saas_usage_tracking; DELETE FROM saas_limits; DELETE FROM saas_addons;
UPDATE companies SET subscription_status='active', active=true;
DELETE FROM companies WHERE name IN ('TESTCO','CHURNCO');
DELETE FROM users WHERE email IN ('chef2@onecomit.sn','chef3@onecomit.sn');" >/dev/null
CID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM companies WHERE name='ONECOMIT';" | head -1)
ADMINID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM users WHERE email='admin@onecomit.sn';" | head -1)
CHEFID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM users WHERE email='chef@onecomit.sn';" | head -1)
if [ -z "$CHEFID" ]; then
  CHEFID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "INSERT INTO users (id, company_id, email, password_hash, full_name, role, active, license_type, license_active) VALUES (gen_random_uuid(), '$CID', 'chef@onecomit.sn', 'x', 'Chef Alpha', 'chef_equipe', true, NULL, true) RETURNING id;" | tr -d ' ' | head -1)
fi

# ============ T1 : enregistrement des metriques ============
M1=$(curl -s -X POST $API/monitoring/metrics -H "$AUTH" -H "$J" -d '{"metricType":"cpu","value":45.5}')
check cpu "$(jget "$M1" metricType)" "T1 metrique CPU enregistree (45.5%)"
check ok "$(jget "$M1" status)" "T1 statut ok sous les seuils"
curl -s -o /dev/null -X POST $API/monitoring/metrics -H "$AUTH" -H "$J" -d '{"metricType":"ram","value":62}'
curl -s -o /dev/null -X POST $API/monitoring/metrics -H "$AUTH" -H "$J" -d '{"metricType":"storage","value":70}'
M_IA=$(curl -s -X POST $API/monitoring/metrics -H "$AUTH" -H "$J" -d '{"metricType":"ia_latency","value":2500}')
curl -s -o /dev/null -X POST $API/monitoring/metrics -H "$AUTH" -H "$J" -d '{"metricType":"api_latency","value":320}'
check warning "$(jget "$M_IA" status)" "T1 latence IA 2500ms -> warning (seuil 2000)"
check 400 "$(code -X POST $API/monitoring/metrics -H "$AUTH" -H "$J" -d '{"metricType":"inconnu","value":1}')" "T1 metrique inconnue -> 400"

# ============ T2 : recuperation avec filtres ============
ALL=$(curl -s $API/monitoring/metrics -H "$AUTH")
check 5 "$(jget "$ALL" length)" "T2 liste : 5 mesures"
CPU_ONLY=$(curl -s "$API/monitoring/metrics?metricType=cpu" -H "$AUTH")
check 1 "$(jget "$CPU_ONLY" length)" "T2 filtre type=cpu -> 1"
FROM=$(curl -s "$API/monitoring/metrics?from=2030-01-01" -H "$AUTH")
check 0 "$(jget "$FROM" length)" "T2 filtre periode future -> 0"

# ============ T3 : statut plateforme ============
ST=$(curl -s $API/monitoring/status -H "$AUTH")
check warning "$(jget "$ST" global)" "T3 statut global = warning (latence IA)"
check 5 "$(jget "$ST" metrics.length)" "T3 5 metriques exposees"
check 1 "$(jget "$ST" openAlerts)" "T3 1 alerte ouverte"

# ============ T4 : alerte critique CPU > 85% ============
MC=$(curl -s -X POST $API/monitoring/metrics -H "$AUTH" -H "$J" -d '{"metricType":"cpu","value":91.2}')
check critical "$(jget "$MC" status)" "T4 CPU 91.2% -> critical"
check 85 "$(jget "$MC" threshold)" "T4 seuil critique 85% trace"
M500=$(curl -s -X POST $API/monitoring/metrics -H "$AUTH" -H "$J" -d '{"metricType":"api_500_errors","value":12}')
check critical "$(jget "$M500" status)" "T4 erreurs 500 : 12/min -> critical"
ST2=$(curl -s $API/monitoring/status -H "$AUTH")
check critical "$(jget "$ST2" global)" "T4 statut global passe a critical"

# ============ T5 : resolution d'alerte ============
ALERTS=$(curl -s "$API/monitoring/alerts?resolved=false" -H "$AUTH")
check 3 "$(jget "$ALERTS" length)" "T5 3 alertes ouvertes (IA warning + CPU critical + 500 critical)"
AID=$(echo "$ALERTS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s).find(x=>x.type==='cpu');console.log(a?a.id:'')})")
RES=$(curl -s -X POST $API/monitoring/alerts/$AID/resolve -H "$AUTH")
check true "$([ -n "$(jget "$RES" resolvedAt)" ] && echo true)" "T5 alerte CPU resolue"
check 2 "$(jget "$(curl -s "$API/monitoring/alerts?resolved=false" -H "$AUTH")" length)" "T5 reste 2 alertes ouvertes"
check 1 "$(jget "$(curl -s "$API/monitoring/alerts?resolved=true" -H "$AUTH")" length)" "T5 1 alerte resolue listee"
check 400 "$(code -X POST $API/monitoring/alerts/$AID/resolve -H "$AUTH")" "T5 re-resolution -> 400"

# ---------- Socle business : licences + options + factures ----------
curl -s -o /dev/null -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d "{\"userId\":\"$ADMINID\",\"planCode\":\"WEB\"}"
curl -s -o /dev/null -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d "{\"userId\":\"$CHEFID\",\"planCode\":\"MOBILE\"}"
curl -s -o /dev/null -X POST $API/saas/addons/ia_vision/activate -H "$AUTH"
# MRR attendu ONECOMIT : 25000 + 10000 + 50000 = 85000

# ============ T6/T7 : dashboard + MRR ============
D=$(curl -s $API/business/dashboard -H "$GTAUTH")
check 85000 "$(jget "$D" mrr)" "T7 MRR global = 85 000 (2 licences + option)"
check 1020000 "$(jget "$D" arr)" "T6 ARR = MRR x 12 = 1 020 000"
check 1 "$(jget "$D" tenants.actifs)" "T6 1 tenant actif (ONECOMIT)"
MRR_T=$(curl -s "$API/business/mrr?companyId=$CID" -H "$GTAUTH")
check 85000 "$(jget "$MRR_T" mrr)" "T7 MRR par tenant ONECOMIT = 85 000"

# ============ T8 : ARR par tenant ============
ARR_T=$(curl -s "$API/business/arr?companyId=$CID" -H "$GTAUTH")
check 1020000 "$(jget "$ARR_T" arr)" "T8 ARR ONECOMIT = 1 020 000"

# ============ T9 : churn ============
# Un tenant resilie (CHURNCO, sans licences)
CHURNCO=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "INSERT INTO companies (id, name, active, subscription_status) VALUES (gen_random_uuid(), 'CHURNCO', false, 'resilie') RETURNING id;" | tr -d ' ' | head -1)
CH=$(curl -s $API/business/churn -H "$GTAUTH")
check 50 "$(jget "$CH" churn)" "T9 churn = 50% (1 resilie / 2 tenants)"
check 1 "$(jget "$(curl -s $API/business/dashboard -H "$GTAUTH")" churn.resilie)" "T9 dashboard : 1 tenant resilie"

# ============ T10 : NRR ============
# Revenu du mois precedent (aout) : facture ONECOMIT payee de 85000 -> NRR = 85000/85000 = 100%
PREV=$(curl -s -X POST "$API/saas/invoices/generate?companyId=$CID" -H "$GTAUTH" -H "$J" -d '{"periodStart":"2026-08-01","periodEnd":"2026-08-31"}')
PIID=$(echo "$PREV" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).invoice.id))")
curl -s -o /dev/null -X PUT "$API/saas/invoices/$PIID/pay?companyId=$CID" -H "$GTAUTH" -H "$J" -d '{"paymentMethod":"bank_transfer"}'
NRR1=$(curl -s "$API/business/nrr?companyId=$CID" -H "$GTAUTH")
check 100 "$(jget "$NRR1" rate)" "T10 NRR = 100% (MRR stable 85 000 / 85 000)"
# Expansion : option pre_audit (+20 000) -> MRR 105 000 -> NRR = 123.53%
curl -s -o /dev/null -X POST $API/saas/addons/pre_audit/activate -H "$AUTH"
NRR2=$(curl -s "$API/business/nrr?companyId=$CID" -H "$GTAUTH")
check 123.53 "$(jget "$NRR2" rate)" "T10 NRR apres expansion = 123.53% (105 000 / 85 000)"

# ============ Bonus : ARPU, LTV, CAC ============
ARPU=$(curl -s $API/business/arpu -H "$GTAUTH")
# revenu paye = 85000 (aout) ; utilisateurs actifs = admin + chef + super_admin GT = 3 -> 28333.33
check 28333.33 "$(jget "$ARPU" value)" "Bonus ARPU = 85 000 / 3 utilisateurs"
LTV=$(curl -s $API/business/ltv -H "$GTAUTH")
check 679999.92 "$(jget "$LTV" value)" "Bonus LTV = ARPU x 24 mois = 679 999.92"
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "INSERT INTO saas_transactions (id, company_id, invoice_id, amount, type, description) VALUES (gen_random_uuid(), '$CID', '$PIID', 350000, 'onboarding', 'Creation tenant + formation');" >/dev/null
CAC=$(curl -s $API/business/cac -H "$GTAUTH")
CACVAL=$(echo "$CAC" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.value+' '+j.newCustomers)})")
CACN="${CACVAL#* }"
CACV="${CACVAL% *}"
check 175000 "$CACV" "Bonus CAC = 350 000 / $CACN nouveaux clients = 175 000"
MRRFINAL=$(curl -s $API/business/mrr -H "$GTAUTH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).mrr))")
check 105000 "$MRRFINAL" "Bonus dashboard MRR final 105 000"

echo "---"
echo "RESULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
