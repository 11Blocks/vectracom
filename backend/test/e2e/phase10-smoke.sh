#!/usr/bin/env bash
# VECTRACOM Phase 10 - KPI SONATEL : test e2e
set -u
API="http://localhost:3100/api/v1"
PASS=0; FAIL=0

check() {
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $3"; else FAIL=$((FAIL+1)); echo "FAIL  $3 (attendu=$1 obtenu=$2)"; fi
}
jget() { node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]}console.log(v===undefined||v===null?'':String(v))" "$1" "$2"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

LOGIN=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@onecomit.sn","password":"Onecomit!2026"}')
TT=$(echo "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$TT" ] && { PASS=$((PASS+1)); echo "PASS  login admin ONECOMIT"; } || { FAIL=$((FAIL+1)); echo "FAIL  login"; }
AUTH="Authorization: Bearer $TT"
J="Content-Type: application/json"

CID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM companies WHERE name='ONECOMIT';")

# Purge d'eterministe (stock inclus : le KPI stock doit etre neutre)
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
DELETE FROM sonatel_kpi_alerts; DELETE FROM sonatel_kpi_logs;
DELETE FROM invoice_penalties; DELETE FROM invoice_lines; DELETE FROM invoices;
DELETE FROM mission_field_reports; DELETE FROM missions;
DELETE FROM compliance_records; DELETE FROM technicians; DELETE FROM teams;
DELETE FROM stock_movements; DELETE FROM stock_levels; DELETE FROM item_serials; DELETE FROM item_batches; DELETE FROM stock_items;" >/dev/null
cd "C:\Users\USER\green_T_4/VECTRACOM 1.0/backend"
docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM price_items WHERE version='2025';" | grep -q "^52$" || npx ts-node scripts/seed-price-items.ts >/dev/null 2>&1
cd - >/dev/null

# ---------- Fixtures missions septembre (resultats deterministes) ----------
# Equipe valide (controle OK) : 1 team + record valide
TEAMID=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD","zone":"Mbour"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
curl -s -o /dev/null -X POST $API/compliance/records -H "$AUTH" -H "$J" -d "{\"teamId\":\"$TEAMID\"}"
RECID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM compliance_records WHERE team_id='$TEAMID';")
curl -s -o /dev/null -X PUT $API/compliance/records/$RECID -H "$AUTH" -H "$J" -d '{"status":"valide"}'

mk() { curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d "{\"clientSite\":\"$1\",\"typeTache\":\"$2\",\"dateMission\":\"$3\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))"; }
# 4 INSTALLATION : 3 succes + 1 echec -> premier_coup = 75% (<98)
for i in 1 2 3; do
  MID=$(mk "Client A$i" "INSTALLATION" "2026-09-0$i")
  docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "INSERT INTO mission_field_reports (id, company_id, mission_id, field_status, signature_client_url) VALUES (gen_random_uuid(), '$CID', '$MID', 'succes', 'https://cdn/s.png'); UPDATE missions SET status='validee', updated_at = date_mission + interval '1 day' WHERE id='$MID';" >/dev/null
done
MID=$(mk "Client A4" "INSTALLATION" "2026-09-04")
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "INSERT INTO mission_field_reports (id, company_id, mission_id, field_status) VALUES (gen_random_uuid(), '$CID', '$MID', 'echec'); UPDATE missions SET status='terminee', updated_at = date_mission + interval '1 day' WHERE id='$MID';" >/dev/null
# 1 INSTALLATION planifiee vieille de 10 j -> backlog EM 1/5=20% (>5) + backlog>5j=1
mk "Client Retard" "INSTALLATION" "2026-09-01" >/dev/null
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "UPDATE missions SET date_mission='2026-09-01', status='planifiee' WHERE client_site='Client Retard';" >/dev/null
# 2 SAV meme site -> repetitions 50% ; releves <4h ; signature -> satisfaction 100%
for i in 1 2; do
  MID=$(mk "Client SAV recurrent" "SAV" "2026-09-1$i")
  docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "UPDATE missions SET status='terminee', created_at='2026-09-15 08:00+00', updated_at='2026-09-15 09:00+00' WHERE id='$MID';" >/dev/null
done

# ============ T1 : calcul des 19 KPI ============
R=$(curl -s -X POST "$API/kpi-sonatel/recalculate?period=2026-09" -H "$AUTH")
check 19 "$(jget "$(curl -s "$API/kpi-sonatel/dashboard?period=2026-09" -H "$AUTH")" total)" "T1 dashboard -> 19 KPI calcules"
DASH=$(curl -s "$API/kpi-sonatel/dashboard?period=2026-09" -H "$AUTH")
KPI() { echo "$DASH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const k=JSON.parse(s).kpis.find(x=>x.kpiName===process.argv[1]);console.log(k?Number(k.actual)+'|'+k.status+'|'+Number(k.penaltyAmount):'ABSENT')})" "$1"; }
check "75|non_atteint|0" "$(KPI production.premier_coup_em)" "T1 premier coup = 75% non atteint (penalite 0 : pas de facture SAV encore)"
check "100|atteint|0" "$(KPI production.on_time_em_3j)" "T1 on time EM = 100% atteint"
check "20|non_atteint|0" "$(KPI production.backlog_em_4j)" "T1 backlog EM = 20% non atteint"
check "1|non_atteint|5000" "$(KPI production.backlog_5j_tous)" "T1 backlog>5j = 1 demande -> penalite 5000"
check "50|non_atteint|0" "$(KPI sav.taux_repetitions_30j)" "T1 repetitions = 50% non atteint"
check "100|atteint|0" "$(KPI sav.releve_4h_b2b)" "T1 releve 4h B2B = 100%"
check "0|atteint|0" "$(KPI controle.equipes_non_validees)" "T1 equipes non validees = 0 (record valide)"
check "100|atteint|0" "$(KPI stock.taux_conformite)" "T1 stock : conformite 100% (aucun item sous seuil)"
NA=$(jget "$DASH" nonAtteints)
[ "$NA" -ge 4 ] && { PASS=$((PASS+1)); echo "PASS  T1 KPI non atteints >= 4 ($NA)"; } || { FAIL=$((FAIL+1)); echo "FAIL  T1 non atteints=$NA"; }

# ============ T2 : alertes ============
AL=$(curl -s "$API/kpi-sonatel/alerts?resolved=false" -H "$AUTH")
ALCOUNT=$(jget "$AL" length)
[ "$ALCOUNT" -ge 4 ] && { PASS=$((PASS+1)); echo "PASS  T2 alertes ouvertes >= 4 ($ALCOUNT)"; } || { FAIL=$((FAIL+1)); echo "FAIL  T2 alertes=$ALCOUNT"; }
FIRST_ALERT=$(echo "$AL" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)[0].id))")
GAP=$(echo "$AL" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s).find(x=>x.kpiName==='production.premier_coup_em');console.log(a?Number(a.gap):'ABSENT')})")
check 23 "$GAP" "T2 gap premier coup = 23 points"
# recalculate a nouveau : pas de doublon d'alertes
curl -s -o /dev/null -X POST "$API/kpi-sonatel/recalculate?period=2026-09" -H "$AUTH"
AL2=$(jget "$(curl -s "$API/kpi-sonatel/alerts?resolved=false" -H "$AUTH")" length)
check "$ALCOUNT" "$AL2" "T2/T9 recalculate idempotent (alertes dedupliquees)"

# ============ T3 : resolution d'alerte ============
RES=$(curl -s -X POST $API/kpi-sonatel/alerts/$FIRST_ALERT/resolve -H "$AUTH")
check true "$(jget "$RES" isResolved)" "T3 alerte resolue"
check true "$([ -n "$(jget "$RES" resolvedAt)" ] && echo true)" "T3 resolvedAt renseigne"
check "$((ALCOUNT-1))" "$(jget "$(curl -s "$API/kpi-sonatel/alerts?resolved=false" -H "$AUTH")" length)" "T3 une alerte ouverte de moins"

# ============ T4 : historique (mois neutres + septembre) ============
for p in 2026-06 2026-07 2026-08; do
  curl -s -o /dev/null -X POST "$API/kpi-sonatel/recalculate?period=$p" -H "$AUTH"
done
HIST=$(curl -s "$API/kpi-sonatel/history?from=2026-01&to=2026-12" -H "$AUTH")
HIST_MONTHS=$(echo "$HIST" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).months.length))")
check 4 "$HIST_MONTHS" "T4 historique -> 4 mois (06, 07, 08, 09)"
HJ=$(curl -s "$API/kpi-sonatel/history?from=2026-07&to=2026-08" -H "$AUTH")
check 2 "$(jget "$HJ" months.length)" "T4 filtre historique 07-08 -> 2 mois"

# ============ T5 : rapport mensuel ============
REP=$(curl -s "$API/kpi-sonatel/report?period=2026-09" -H "$AUTH")
check 19 "$(jget "$REP" summary.total)" "T5 rapport : 19 KPI detailles"
check true "$([ -n "$(jget "$REP" summary.penaltiesTotal)" ] && echo true)" "T5 rapport : penalites totales presentes"

# ============ T6/T7 : penalites -> facture (Phase 9) ============
GEN=$(curl -s -X POST $API/invoices/generate -H "$AUTH" -H "$J" -d '{"periodStart":"2026-09-01","periodEnd":"2026-09-30"}')
IID=$(echo "$GEN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
[ -n "$IID" ] && { PASS=$((PASS+1)); echo "PASS  T7 facture septembre generee pour TCO"; } || { FAIL=$((FAIL+1)); echo "FAIL  T7 facture"; }
# Recalcul avec TCO : premier coup (PRODUCTION 54000*... lignes INSTALLATION)
curl -s -o /dev/null -X POST "$API/kpi-sonatel/recalculate?period=2026-09" -H "$AUTH"
PEN=$(curl -s "$API/kpi-sonatel/penalties?period=2026-09" -H "$AUTH")
check true "$([ "$(jget "$PEN" total)" != "0" ] && [ -n "$(jget "$PEN" total)" ] && echo true)" "T6 penalites calculees > 0 ($(jget "$PEN" total) FCFA)"
# Application a la facture
APP=$(curl -s -X POST "$API/kpi-sonatel/penalties/apply?period=2026-09&invoiceId=$IID" -H "$AUTH")
check true "$([ "$(jget "$APP" total)" != "0" ] && echo true)" "T7 penalites appliquees a la facture ($(jget "$APP" total) FCFA)"
INV=$(curl -s $API/invoices/$IID -H "$AUTH")
check true "$([ "$(jget "$INV" penaltiesTotal)" != "0" ] && echo true)" "T7 invoice.penaltiesTotal > 0 ($(jget "$INV" penaltiesTotal))"
NPEN=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM invoice_penalties WHERE invoice_id='$IID';")
[ "$NPEN" -ge 3 ] && { PASS=$((PASS+1)); echo "PASS  T7 $NPEN lignes invoice_penalties creees"; } || { FAIL=$((FAIL+1)); echo "FAIL  T7 lignes penalites=$NPEN"; }
# TTC reduit : penalites soustraites
PV=$(curl -s $API/invoices/$IID/preview -H "$AUTH")
check "$(node -e "const j=JSON.parse(process.argv[1]);console.log(Math.round(j.totals.totalHt + j.totals.totalTva - j.totals.penaltiesTotal))" "$PV")" "$(jget "$INV" totalTtc | sed 's/\.00$//')" "T7 TTC = HT + TVA - penalites"

# ============ T8 : bonus 3 mois consecutifs ============
# Juin/juillet/aout : tous neutres -> atteints. Septembre a des non-atteints.
B1=$(curl -s "$API/kpi-sonatel/report?period=2026-08" -H "$AUTH")
check true "$(jget "$B1" bonus.eligible)" "T8 bonus eligible pour aout (06+07+08 tous atteints)"
check 3 "$(jget "$B1" bonus.months.length)" "T8 bonus calcule sur 3 mois"
B2=$(curl -s "$API/kpi-sonatel/report?period=2026-09" -H "$AUTH")
check false "$(jget "$B2" bonus.eligible)" "T8 bonus non eligible pour septembre (KIC non atteints)"
check 5000000 "$(jget "$B1" bonus.plafond)" "T8 plafond bonus 5 000 000"

echo "---"
echo "RESULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
