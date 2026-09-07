#!/usr/bin/env bash
# VECTRACOM Phase 6 — Véhicules : test de bout en bout
set -u
API="http://localhost:3100/api/v1"
PASS=0; FAIL=0

check() {
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $3"; else FAIL=$((FAIL+1)); echo "FAIL  $3 (attendu=$1 obtenu=$2)"; fi
}
jget() { node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]}console.log(v===undefined||v===null?'':String(v))" "$1" "$2"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
din() { date -u -d "$1" +%Y-%m-%d; }

LOGIN=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@onecomit.sn","password":"Onecomit!2026"}')
TT=$(echo "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$TT" ] && { PASS=$((PASS+1)); echo "PASS  login admin ONECOMIT"; } || { FAIL=$((FAIL+1)); echo "FAIL  login"; }
AUTH="Authorization: Bearer $TT"
J="Content-Type: application/json"

# Purge déterministe (vehicle_checks/documents/vehicles puis warehouses VEHICLE orphelins)
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "DELETE FROM vehicle_checks; DELETE FROM vehicle_documents; DELETE FROM vehicles; DELETE FROM stock_levels WHERE warehouse_id IN (SELECT id FROM warehouses WHERE type='VEHICLE'); DELETE FROM stock_movements WHERE from_warehouse_id IN (SELECT id FROM warehouses WHERE type='VEHICLE') OR to_warehouse_id IN (SELECT id FROM warehouses WHERE type='VEHICLE'); DELETE FROM warehouses WHERE type='VEHICLE';" >/dev/null

# Équipe cible pour les filtres
TEAM=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD","zone":"Mbour"}' 2>/dev/null)
TEAMID=$(echo "$TEAM" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ -z "$TEAMID" ]; then TEAMID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM teams WHERE name='Alpha' LIMIT 1;"); fi

# ============ T1 : création véhicule + warehouse VEHICLE auto ============
V1=$(curl -s -X POST $API/vehicles -H "$AUTH" -H "$J" -d "{
  \"immatriculation\":\"dk-4521-ab\",\"modele\":\"Toyota Hilux\",\"teamId\":\"$TEAMID\",
  \"kilometrage\":84000,\"insuranceExpiration\":\"$(din '+45 days')\",\"technicalInspectionExpiration\":\"$(din '+20 days')\",
  \"nextMaintenanceKm\":100000,\"monthlyCost\":180000}")
VID1=$(echo "$V1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$VID1" ] && { PASS=$((PASS+1)); echo "PASS  T1 véhicule créé"; } || { FAIL=$((FAIL+1)); echo "FAIL  T1 création"; }
check DK-4521-AB "$(jget "$V1" immatriculation)" "T1 immatriculation normalisée (majuscules)"
WH=$(curl -s "$API/warehouses?type=VEHICLE" -H "$AUTH")
check 1 "$(jget "$WH" length)" "T1 warehouse VEHICLE auto-créé (1 au total)"
check DK-4521-AB "$(jget "$WH" 0.name)" "T1 l'entrepôt porte le nom de l'immatriculation"
check "$(jget "$WH" 0.id)" "$(jget "$V1" warehouseId)" "T1 vehicle.warehouseId pointe vers l'entrepôt"
check 409 "$(code -X POST $API/vehicles -H "$AUTH" -H "$J" -d '{"immatriculation":"DK-4521-AB","modele":"X"}')" "T1 doublon d'immatriculation → 409"

# ============ T2 : kilométrage + statut ============
U1=$(curl -s -X PUT $API/vehicles/$VID1 -H "$AUTH" -H "$J" -d '{"kilometrage":84500}')
check 84500 "$(jget "$U1" kilometrage)" "T2 kilométrage mis à jour"
U2=$(curl -s -X PUT $API/vehicles/$VID1 -H "$AUTH" -H "$J" -d '{"status":"en_mission"}')
check en_mission "$(jget "$U2" status)" "T2 statut mis à jour"

# ============ T3 : badges (rouge ≤7j, orange ≤30j, vert >30j/absent) ============
V2=$(curl -s -X POST $API/vehicles -H "$AUTH" -H "$J" -d "{\"immatriculation\":\"DK-8832-CD\",\"modele\":\"Renault Kangoo\",\"teamId\":\"$TEAMID\",\"insuranceExpiration\":\"$(din '+5 days')\",\"technicalInspectionExpiration\":\"$(din '+90 days')\"}")
VID2=$(echo "$V2" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
V3=$(curl -s -X POST $API/vehicles -H "$AUTH" -H "$J" -d "{\"immatriculation\":\"TH-1107-EF\",\"modele\":\"Peugeot Partner\",\"insuranceExpiration\":\"$(din '+200 days')\",\"technicalInspectionExpiration\":\"$(din '+3 days')\"}")
VID3=$(echo "$V3" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
V4=$(curl -s -X POST $API/vehicles -H "$AUTH" -H "$J" -d '{"immatriculation":"KL-7788-GH","modele":"Dacia Dokker"}')
VID4=$(echo "$V4" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

B1=$(curl -s $API/vehicles/$VID1/expiry-badges -H "$AUTH")
check vert "$(jget "$B1" insurance.badge)" "T3 V1 assurance J+45 → vert"
check orange "$(jget "$B1" technicalInspection.badge)" "T3 V1 visite J+20 → orange"
check orange "$(jget "$B1" global)" "T3 V1 global = orange (le pire l'emporte)"
B2=$(curl -s $API/vehicles/$VID2/expiry-badges -H "$AUTH")
check rouge "$(jget "$B2" insurance.badge)" "T3 V2 assurance J+5 → rouge"
B3=$(curl -s $API/vehicles/$VID3/expiry-badges -H "$AUTH")
check rouge "$(jget "$B3" global)" "T3 V3 visite J+3 → global rouge"
check 3 "$(jget "$B3" technicalInspection.daysLeft)" "T3 V3 jours restants = 3"
B4=$(curl -s $API/vehicles/$VID4/expiry-badges -H "$AUTH")
check vert "$(jget "$B4" global)" "T3 V4 sans échéances → vert"
check "" "$(jget "$B4" insurance.daysLeft)" "T3 V4 daysLeft null (non défini)"
VEXP=$(curl -s -X POST $API/vehicles -H "$AUTH" -H "$J" -d "{\"immatriculation\":\"DK-0000-ZZ\",\"insuranceExpiration\":\"$(din '-10 days')\"}")
VIDE=$(echo "$VEXP" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
B5=$(curl -s $API/vehicles/$VIDE/expiry-badges -H "$AUTH")
check rouge "$(jget "$B5" insurance.badge)" "T3 assurance dépassée (J-10) → rouge"
LF=$(curl -s "$API/vehicles?echeance=rouge" -H "$AUTH")
check 3 "$(jget "$LF" length)" "T3 filtre echeance=rouge → 3 véhicules (V2, V3, J-10)"

# ============ T4/T5 : check 1×/jour ============
C1=$(curl -s -X POST $API/vehicles/$VID1/checks -H "$AUTH" -H "$J" -d '{"huile":true,"eau":true,"freins":true,"pneus":true,"batterie":true,"eclairage":true,"observations":"RAS"}')
check true "$(jget "$C1" huile)" "T4 check créé (points de contrôle enregistrés)"
check 409 "$(code -X POST $API/vehicles/$VID1/checks -H "$AUTH" -H "$J" -d '{"huile":true,"eau":true,"freins":true,"pneus":true,"batterie":true,"eclairage":true}')" "T5 second check le même jour → 409"
check 1 "$(jget "$(curl -s $API/vehicles/$VID1/checks -H "$AUTH")" length)" "T5 historique : 1 check"
C2=$(curl -s -X POST $API/vehicles/$VID2/checks -H "$AUTH" -H "$J" -d '{"huile":true,"eau":false,"freins":true,"pneus":true,"batterie":true,"eclairage":true,"observations":"Niveau eau bas — appoint fait"}')
check false "$(jget "$C2" eau)" "T5 check d'un autre véhicule OK (règle par véhicule)"

# ============ T6 : pochettes digitales ============
curl -s -o /dev/null -X POST $API/vehicles/$VID1/documents -H "$AUTH" -H "$J" -d '{"docType":"carte_grise","fileUrl":"https://cdn/cg-dk4521.pdf"}'
curl -s -o /dev/null -X POST $API/vehicles/$VID1/documents -H "$AUTH" -H "$J" -d "{\"docType\":\"assurance\",\"fileUrl\":\"https://cdn/ass-dk4521.pdf\",\"expirationDate\":\"$(din '+45 days')\"}"
D3=$(curl -s -X POST $API/vehicles/$VID1/documents -H "$AUTH" -H "$J" -d "{\"docType\":\"visite_technique\",\"fileUrl\":\"https://cdn/vt-dk4521.pdf\",\"expirationDate\":\"$(din '+20 days')\"}")
DID3=$(echo "$D3" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
DOCS=$(curl -s $API/vehicles/$VID1/documents -H "$AUTH")
check 3 "$(jget "$DOCS" length)" "T6 pochette : 3 documents (grise, assurance, visite)"
check 400 "$(code -X POST $API/vehicles/$VID1/documents -H "$AUTH" -H "$J" -d '{"docType":"permis","fileUrl":"https://cdn/x.pdf"}')" "T6 type de document inconnu → 400"
DEL=$(curl -s -X DELETE $API/vehicles/$VID1/documents/$DID3 -H "$AUTH")
check true "$(jget "$DEL" deleted)" "T6 suppression d'un document"
check 2 "$(jget "$(curl -s $API/vehicles/$VID1/documents -H "$AUTH")" length)" "T6 pochette : 2 documents restants"

# ============ T8/T9 : filtres équipe / statut ============
check 2 "$(jget "$(curl -s "$API/vehicles?teamId=$TEAMID" -H "$AUTH")" length)" "T8 filtre par équipe → 2 (V1, V2)"
check 1 "$(jget "$(curl -s "$API/vehicles?status=en_mission" -H "$AUTH")" length)" "T9 filtre par statut → 1"

# ============ T7 : suppression véhicule (+ warehouse) ============
NB_W_BEFORE=$(jget "$(curl -s "$API/warehouses?type=VEHICLE" -H "$AUTH")" length)
DELV=$(curl -s -X DELETE $API/vehicles/$VID4 -H "$AUTH")
check true "$(jget "$DELV" deleted)" "T7 véhicule supprimé"
NB_W_AFTER=$(jget "$(curl -s "$API/warehouses?type=VEHICLE" -H "$AUTH")" length)
check 5 "$NB_W_BEFORE" "T7 avant suppression : 5 entrepôts VEHICLE"
check 4 "$NB_W_AFTER" "T7 warehouse associé supprimé avec le véhicule"
check 404 "$(code $API/vehicles/$VID4 -H "$AUTH")" "T7 véhicule introuvable après suppression"

# Véhicule avec stock : suppression bloquée
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "INSERT INTO stock_levels (id, company_id, stock_item_id, warehouse_id, quantity) SELECT gen_random_uuid(), company_id, (SELECT id FROM stock_items LIMIT 1), warehouse_id, 5 FROM vehicles WHERE id='$VID1';" >/dev/null
check 409 "$(code -X DELETE $API/vehicles/$VID1 -H "$AUTH")" "T7 suppression refusée si la camionnette détient du stock → 409"
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "DELETE FROM stock_levels WHERE warehouse_id=(SELECT warehouse_id FROM vehicles WHERE id='$VID1');" >/dev/null

echo "---"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
