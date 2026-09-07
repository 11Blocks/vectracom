#!/usr/bin/env bash
# VECTRACOM Phase 11 - Rapports (5 predefinis) : test e2e
set -u
API="http://localhost:3100/api/v1"
PASS=0; FAIL=0
OUTDIR="$(cd "$(dirname "$0")" && pwd)"

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

# ---------- Purge + fixtures ----------
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
DELETE FROM sonatel_kpi_alerts; DELETE FROM sonatel_kpi_logs;
DELETE FROM invoice_penalties; DELETE FROM invoice_lines; DELETE FROM invoices;
DELETE FROM mission_field_reports; DELETE FROM missions;
DELETE FROM compliance_records; DELETE FROM technicians; DELETE FROM teams;
DELETE FROM stock_movements; DELETE FROM stock_levels; DELETE FROM item_serials; DELETE FROM item_batches; DELETE FROM stock_items;
DELETE FROM vehicle_checks; DELETE FROM vehicle_documents; DELETE FROM vehicles;
DELETE FROM warehouses;
DELETE FROM expenses;
-- Table incidents : creee si absente (l'entite Phase 12 l'etend via synchronize)
CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  rubrique text NOT NULL, zone text NOT NULL, status text NOT NULL,
  severity text, reported_at timestamptz NOT NULL, resolved_at timestamptz
);
TRUNCATE incidents;" >/dev/null

# Equipe + 2 techniciens
TEAMID=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD","zone":"Mbour"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
T1=$(curl -s -X POST $API/technicians -H "$AUTH" -H "$J" -d "{\"fullName\":\"Ndiaye Moussa\",\"teamId\":\"$TEAMID\",\"isTeamLeader\":true}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
T2=$(curl -s -X POST $API/technicians -H "$AUTH" -H "$J" -d "{\"fullName\":\"Sow Abdallahi\",\"teamId\":\"$TEAMID\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")

mk() { curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d "{\"clientSite\":\"$1\",\"typeTache\":\"$2\",\"dateMission\":\"$3\",\"sonatelOlt\":\"$4\",\"technicianIds\":[\"$5\"]}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))"; }
close() { docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "INSERT INTO mission_field_reports (id, company_id, mission_id, field_status, failure_reason, signature_client_url) VALUES (gen_random_uuid(), '$CID', '$1', '$2', $3, $4); UPDATE missions SET status='$5', updated_at = date_mission + interval '1 day' WHERE id='$1';" >/dev/null; }

# O_GMB : 2 INSTALLATION succes (T1, T2) + 1 SAV succes (T2)
close "$(mk "Client A1" "INSTALLATION" "2026-09-02" "O_GMB" "$T1")" succes NULL "'https://cdn/s.png'" validee
close "$(mk "Client A2" "INSTALLATION" "2026-09-04" "O_GMB" "$T2")" succes NULL "'https://cdn/s.png'" validee
close "$(mk "Client SAV" "SAV" "2026-09-10" "O_GMB" "$T2")" succes NULL "'https://cdn/s.png'" terminee
# O_THI : 1 INSTALLATION echec (T1) + 1 planifiee
MID_B1=$(mk "Client B1" "INSTALLATION" "2026-09-06" "O_THI" "$T1")
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "INSERT INTO mission_field_reports (id, company_id, mission_id, field_status, failure_reason) VALUES (gen_random_uuid(), '$CID', '$MID_B1', 'echec', 'PBO inaccessible'); UPDATE missions SET status='terminee', updated_at = date_mission + interval '1 day' WHERE id='$MID_B1';" >/dev/null
mk "Client B2" "INSTALLATION" "2026-09-12" "O_THI" "$T1" >/dev/null
# O_DKR : 1 INSTALLATION succes (T1)
close "$(mk "Client C1" "INSTALLATION" "2026-09-08" "O_DKR" "$T1")" succes NULL "'https://cdn/s.png'" validee

# Stock : 1 item + consommation 40 sur la periode ; véhicule + 2 dépenses transport (30000+20000)
SID=$(curl -s -X POST $API/stock-items -H "$AUTH" -H "$J" -d '{"reference":"FO-CAB-24","designation":"Cable FO 24","category":"CONSUMABLE","family":"FIBRE","unit":"m","thresholdAlert":10}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
WID=$(curl -s -X POST $API/warehouses -H "$AUTH" -H "$J" -d '{"type":"CENTRAL","name":"Depot Test","zone":"Mbour"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID\",\"type\":\"entree\",\"quantity\":100,\"toWarehouseId\":\"$WID\"}"
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID\",\"type\":\"consommation\",\"quantity\":40,\"fromWarehouseId\":\"$WID\"}"
VID=$(curl -s -X POST $API/vehicles -H "$AUTH" -H "$J" -d '{"immatriculation":"DK-4521-AB","modele":"Toyota Hilux","kilometrage":84500}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
curl -s -o /dev/null -X POST $API/expenses -H "$AUTH" -H "$J" -d "{\"category\":\"transport\",\"amount\":30000,\"vehicleId\":\"$VID\",\"description\":\"Carburant\"}"
curl -s -o /dev/null -X POST $API/expenses -H "$AUTH" -H "$J" -d "{\"category\":\"transport\",\"amount\":20000,\"vehicleId\":\"$VID\",\"description\":\"Carburant 2\"}"

# Incidents : PBO resolu 24h, PIO resolu 48h, CHAMBRE ouvert
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
INSERT INTO incidents (id, company_id, incident_number, rubrique, zone, status, reported_at, resolved_at) VALUES
 (gen_random_uuid(), '$CID', 'INC-2026-9001', 'PBO', 'Mbour', 'corrige', '2026-09-05 08:00+00', '2026-09-06 08:00+00'),
 (gen_random_uuid(), '$CID', 'INC-2026-9002', 'PIO', 'Saly', 'corrige', '2026-09-08 09:00+00', '2026-09-10 09:00+00'),
 (gen_random_uuid(), '$CID', 'INC-2026-9003', 'CHAMBRE', 'Mbour', 'signalement', '2026-09-20 10:00+00', NULL);" >/dev/null

# KPI du mois (recalcule pour le rapport 4)
curl -s -o /dev/null -X POST "$API/kpi-sonatel/recalculate?period=2026-09" -H "$AUTH"

P="startDate=2026-09-01&endDate=2026-09-30"

# ============ T1 : performance ============
R1=$(curl -s "$API/reports/performance?$P" -H "$AUTH")
check 6 "$(jget "$R1" totalMissions)" "T1 total missions = 6"
check 5 "$(jget "$R1" closedMissions)" "T1 missions cloturees = 5"
check 80 "$(jget "$R1" okRate)" "T1 taux OK = 80% (4/5)"
check 20 "$(jget "$R1" nokRate)" "T1 taux NOK = 20%"
check 2 "$(jget "$R1" byTechnician.length)" "T1 classement : 2 techniciens"
check 3 "$(jget "$R1" byTechnician.0.missions)" "T1 technicien 1 : 3 missions (Ndiaye)"
check 1 "$(jget "$R1" topFailureReasons.0.count)" "T1 top motif NOK : PBO inaccessible (1)"

# ============ T2 : zones OLT ============
R2=$(curl -s "$API/reports/olt?$P" -H "$AUTH")
check 3 "$(jget "$R2" byZone.length)" "T2 3 zones OLT"
ZG=$(echo "$R2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const z=JSON.parse(s).byZone.find(x=>x.zone==='O_GMB');console.log(z.recues+'|'+z.executees+'|'+z.enAttente+'|'+z.tauxReussite)})")
check "3|3|0|100" "$ZG" "T2 O_GMB : 3 recues / 3 executees / 0 attente / 100%"
ZT=$(echo "$R2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const z=JSON.parse(s).byZone.find(x=>x.zone==='O_THI');console.log(z.recues+'|'+z.executees+'|'+z.enAttente+'|'+z.tauxReussite)})")
check "2|1|1|0" "$ZT" "T2 O_THI : 2 recues / 1 executee / 1 attente / 0%"
check 80 "$(jget "$R2" successRate)" "T2 taux de reussite global = 80%"

# ============ T3 : stock & vehicules ============
R3=$(curl -s "$API/reports/stock-vehicles?$P" -H "$AUTH")
check 40 "$(jget "$R3" totalConsumed)" "T3 materiel consomme = 40 unites"
check 3 "$(jget "$R3" installationsValidees)" "T3 installations validees = 3"
check 13.33 "$(jget "$R3" installationRatio)" "T3 ratio consommation/installation = 13.33"
check 50000 "$(jget "$R3" coutTransportTotal)" "T3 cout transport total = 50 000 FCFA"
check DK-4521-AB "$(jget "$R3" vehicleCosts.0.immatriculation)" "T3 vehicule avec couts"

# ============ T4 : KPI SONATEL ============
R4=$(curl -s "$API/reports/kpi?month=2026-09" -H "$AUTH")
check 19 "$(jget "$R4" summary.total)" "T4 rapport KPI : 19 indicateurs"
check 19 "$(jget "$R4" details.length)" "T4 details avec feux (vert/orange/rouge)"
check true "$([ -n "$(jget "$R4" nonAtteints.0.kpiName)" ] && echo true)" "T4 detail des non-atteints present"
check 1 "$(jget "$R4" history.length)" "T4 historique (1 mois evalue)"
check true "$([ -n "$(jget "$R4" penalties.total)" ] && echo true)" "T4 penalites calculees"

# ============ T5 : incidents ============
R5=$(curl -s "$API/reports/incidents?$P" -H "$AUTH")
check 3 "$(jget "$R5" total)" "T5 total incidents = 3"
check 3 "$(jget "$R5" byRubrique.length)" "T5 3 rubriques (PBO/PIO/CHAMBRE)"
check 36 "$(jget "$R5" averageResolutionTimeHours)" "T5 delai moyen de correction = 36h"
check 1 "$(jget "$R5" tendance.length)" "T5 tendance mensuelle"
check 2 "$(jget "$(curl -s "$API/reports/incidents?$P" -H "$AUTH")" byZone.0.count)" "T5 zone Mbour = 2 incidents"

# ============ T6 : exports PDF (5 rapports) ============
for rep in performance olt stock-vehicles kpi incidents; do
  if [ "$rep" = "kpi" ]; then BODY='{"report":"kpi","month":"2026-09"}'; else BODY="{\"report\":\"$rep\",\"startDate\":\"2026-09-01\",\"endDate\":\"2026-09-30\"}"; fi
  curl -s -o "$OUTDIR/rapport-$rep.pdf" -w "" -X POST $API/reports/export-pdf -H "$AUTH" -H "$J" -d "$BODY"
  if head -c 5 "$OUTDIR/rapport-$rep.pdf" | grep -q "%PDF"; then PASS=$((PASS+1)); echo "PASS  T6 PDF $rep"; else FAIL=$((FAIL+1)); echo "FAIL  T6 PDF $rep"; fi
done

# ============ T7 : exports Excel (5 rapports) ============
for rep in performance olt stock-vehicles kpi incidents; do
  if [ "$rep" = "kpi" ]; then BODY='{"report":"kpi","month":"2026-09"}'; else BODY="{\"report\":\"$rep\",\"startDate\":\"2026-09-01\",\"endDate\":\"2026-09-30\"}"; fi
  curl -s -o "$OUTDIR/rapport-$rep.xlsx" -w "" -X POST $API/reports/export-excel -H "$AUTH" -H "$J" -d "$BODY"
  SHEETS=$(node "$OUTDIR/read-report-xlsx.js" "$OUTDIR/rapport-$rep.xlsx" 2>/dev/null)
  if [ -n "$SHEETS" ] && [[ "$SHEETS" == *"Synthese"* ]]; then PASS=$((PASS+1)); echo "PASS  T7 Excel $rep ($SHEETS)"; else FAIL=$((FAIL+1)); echo "FAIL  T7 Excel $rep ($SHEETS)"; fi
done
# Verification de contenu : le classement techniciens dans l'Excel performance
PERF_ROWS=$(node "$OUTDIR/read-report-xlsx.js" "$OUTDIR/rapport-performance.xlsx" "Par technicien" 2>/dev/null)
check true "$(echo "$PERF_ROWS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const rows=JSON.parse(s);console.log(rows.some(r=>r.fullName==='Ndiaye Moussa'&&r.missions===3)?'true':'false')})")" "T7 Excel performance : contenu technicien verifie"
check 400 "$(code -X POST $API/reports/export-pdf -H "$AUTH" -H "$J" -d '{"report":"inconnu"}')" "T6 rapport inconnu -> 400"

echo "---"
echo "RESULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
