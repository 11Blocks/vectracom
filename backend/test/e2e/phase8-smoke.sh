#!/usr/bin/env bash
# VECTRACOM Phase 8 — RH & Comptabilité : test de bout en bout
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

# Purge déterministe (véhicules + entrepôts VEHICLE inclus : le warehouse
# porte le nom de l'immatriculation, sinon il bloque les recréations)
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
DELETE FROM leave_requests; DELETE FROM attendance; DELETE FROM expenses; DELETE FROM employees;
DELETE FROM mission_field_reports; DELETE FROM missions;
DELETE FROM vehicle_checks; DELETE FROM vehicle_documents; DELETE FROM vehicles;
DELETE FROM stock_levels WHERE warehouse_id IN (SELECT id FROM warehouses WHERE type='VEHICLE');
DELETE FROM stock_movements WHERE from_warehouse_id IN (SELECT id FROM warehouses WHERE type='VEHICLE') OR to_warehouse_id IN (SELECT id FROM warehouses WHERE type='VEHICLE');
DELETE FROM warehouses WHERE type='VEHICLE';
DELETE FROM technicians; DELETE FROM teams;" >/dev/null

# Socle : équipe, technicien, véhicule, mission (pour rattachements)
TEAMID=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD","zone":"Mbour"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
TECH=$(curl -s -X POST $API/technicians -H "$AUTH" -H "$J" -d "{\"fullName\":\"Ndiaye Moussa\",\"teamId\":\"$TEAMID\",\"isTeamLeader\":true,\"competences\":[\"DEPLOIEMENT\"]}")
TECHID=$(echo "$TECH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
VEHID=$(curl -s -X POST $API/vehicles -H "$AUTH" -H "$J" -d '{"immatriculation":"DK-4521-AB","modele":"Toyota Hilux"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
MISID=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Client Diallo","typeTache":"INSTALLATION","dateMission":"2026-09-15","teamId":"'"$TEAMID"'","technicianIds":["'"$TECHID"'"]}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")

# ============ T1 : employé avec documents ============
E1=$(curl -s -X POST $API/employees -H "$AUTH" -H "$J" -d "{
  \"fullName\":\"Ndiaye Moussa\",\"jobTitle\":\"Chef d'équipe FTTH\",\"teamId\":\"$TEAMID\",\"vehicleId\":\"$VEHID\",
  \"matricule\":\"ONE-TER-014\",\"habilitationExpiration\":\"2027-03-15\",
  \"documents\":[
    {\"type\":\"CNI\",\"fileUrl\":\"https://cdn/cni.pdf\"},
    {\"type\":\"CONTRAT\",\"fileUrl\":\"https://cdn/contrat.pdf\",\"expirationDate\":\"2027-12-31\"},
    {\"type\":\"DIPLOME\",\"fileUrl\":\"https://cdn/diplome.pdf\"}]}")
EID1=$(echo "$E1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check actif "$(jget "$E1" status)" "T1 employé créé (statut actif)"
check 3 "$(jget "$E1" documents.length)" "T1 3 documents (CNI, contrat, diplôme)"
check Alpha "$(jget "$E1" team.name)" "T1 rattaché à l'équipe Alpha"
check 400 "$(code -X POST $API/employees -H "$AUTH" -H "$J" -d '{"fullName":"X","documents":[{"type":"PASSEPORT","fileUrl":"https://x"}]}')" "T1 type de document inconnu → 400"
E2=$(curl -s -X POST $API/employees -H "$AUTH" -H "$J" -d '{"fullName":"Aminata Diop","jobTitle":"Responsable administrative","matricule":"ONE-ADM-001"}')
EID2=$(echo "$E2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check 2 "$(jget "$(curl -s $API/employees -H "$AUTH")" length)" "T1 liste → 2 employés"

# ============ T2 : demande de congé (2 clics) ============
L1=$(curl -s -X POST $API/leave-requests -H "$AUTH" -H "$J" -d "{\"employeeId\":\"$EID1\",\"startDate\":\"2026-10-05\",\"endDate\":\"2026-10-12\",\"reason\":\"Congé annuel\"}")
LID1=$(echo "$L1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check en_attente "$(jget "$L1" status)" "T2 demande créée → en_attente"
check 400 "$(code -X POST $API/leave-requests -H "$AUTH" -H "$J" -d "{\"employeeId\":\"$EID1\",\"startDate\":\"2026-10-12\",\"endDate\":\"2026-10-05\"}")" "T2 fin avant début → 400"

# ============ T3 : validation manager ============
A1=$(curl -s -X PUT $API/leave-requests/$LID1/approve -H "$AUTH")
check approuve "$(jget "$A1" status)" "T3 congé approuvé"
check en_conge "$(jget "$(curl -s $API/employees/$EID1 -H "$AUTH")" status)" "T3 employé passé en_conge"
check 400 "$(code -X PUT $API/leave-requests/$LID1/refuse -H "$AUTH")" "T3 re-décision sur demande traitée → 400"
L2=$(curl -s -X POST $API/leave-requests -H "$AUTH" -H "$J" -d "{\"employeeId\":\"$EID2\",\"startDate\":\"2026-11-02\",\"endDate\":\"2026-11-04\",\"reason\":\"Absence familiale\"}")
LID2=$(echo "$L2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
R2=$(curl -s -X PUT $API/leave-requests/$LID2/refuse -H "$AUTH")
check refuse "$(jget "$R2" status)" "T3 congé refusé"
check actif "$(jget "$(curl -s $API/employees/$EID2 -H "$AUTH")" status)" "T3 refus : employé reste actif"
check 1 "$(jget "$(curl -s "$API/leave-requests?status=approuve" -H "$AUTH")" length)" "T3 filtre par statut → 1 approuvé"

# ============ T4 : feuille de présence L M M J V S ============
P1=$(curl -s -X POST $API/attendance -H "$AUTH" -H "$J" -d "{
  \"technicianId\":\"$TECHID\",\"weekStart\":\"2026-09-14\",
  \"monday\":true,\"tuesday\":true,\"wednesday\":true,\"thursday\":true,\"friday\":true,\"saturday\":false,\"sunday\":false,
  \"comments\":\"Semaine complète\"}")
AID=$(echo "$P1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check 2026-09-14 "$(jget "$P1" weekStart)" "T4 feuille créée (semaine du lundi 14/09)"
check true "$(jget "$P1" friday)" "T4 vendredi présent"
# Upsert : correction de la même semaine (samedi travaillé) — pas de doublon
P2=$(curl -s -X POST $API/attendance -H "$AUTH" -H "$J" -d "{\"technicianId\":\"$TECHID\",\"weekStart\":\"2026-09-16\",\"saturday\":true}")
check 2026-09-14 "$(jget "$P2" weekStart)" "T4 mercredi 16 normalisé vers le lundi 14"
check true "$(jget "$P2" saturday)" "T4 samedi corrigé (upsert)"
check true "$(jget "$P2" monday)" "T4 jours précédents conservés (lundi)"
CNT=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM attendance WHERE technician_id='$TECHID' AND week_start='2026-09-14';")
check 1 "$CNT" "T4 unicité (technicien × semaine) — une seule feuille"
check 1 "$(jget "$(curl -s "$API/attendance?weekStart=2026-09-14" -H "$AUTH")" length)" "T4 filtre par semaine → 1"

# ============ T5 : validation de la feuille ============
V1=$(curl -s -X PUT $API/attendance/$AID/validate -H "$AUTH")
check true "$([ -n "$(jget "$V1" validatedAt)" ] && echo true)" "T5 feuille validée (validatedAt)"
check 400 "$(code -X PUT $API/attendance/$AID/validate -H "$AUTH")" "T5 re-validation → 400"

# ============ T6 : dépenses (4 catégories) ============
D1=$(curl -s -X POST $API/expenses -H "$AUTH" -H "$J" -d '{"category":"main_oeuvre","amount":250000,"description":"Salaire prime équipe Sept."}')
check main_oeuvre "$(jget "$D1" category)" "T6 dépense main_œuvre"
curl -s -o /dev/null -X POST $API/expenses -H "$AUTH" -H "$J" -d '{"category":"materiel","amount":48500,"receiptPhotoUrl":"https://cdn/recu-outillage.jpg","description":"Achat outillage"}'
curl -s -o /dev/null -X POST $API/expenses -H "$AUTH" -H "$J" -d '{"category":"materiel","amount":12000,"description":"Colsons et gaines"}'
curl -s -o /dev/null -X POST $API/expenses -H "$AUTH" -H "$J" -d '{"category":"divers","amount":7500}'
check 400 "$(code -X POST $API/expenses -H "$AUTH" -H "$J" -d '{"category":"loisirs","amount":100}')" "T6 catégorie inconnue → 400"
check 4 "$(jget "$(curl -s $API/expenses -H "$AUTH")" length)" "T6 liste → 4 dépenses"

# ============ T7 : rattachement véhicule ============
DV=$(curl -s -X POST $API/expenses -H "$AUTH" -H "$J" -d "{\"category\":\"transport\",\"amount\":32000,\"vehicleId\":\"$VEHID\",\"receiptPhotoUrl\":\"https://cdn/carburant.jpg\",\"description\":\"Carburant camionnette\"}")
DVID=$(echo "$DV" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check DK-4521-AB "$(jget "$(curl -s $API/expenses/$DVID -H "$AUTH")" vehicle.immatriculation)" "T7 dépense rattachée au véhicule DK-4521-AB"
check 1 "$(jget "$(curl -s "$API/expenses?vehicleId=$VEHID" -H "$AUTH")" length)" "T7 filtre par véhicule → 1"

# ============ T8 : rattachement technicien ============
DT=$(curl -s -X POST $API/expenses -H "$AUTH" -H "$J" -d "{\"category\":\"divers\",\"amount\":5000,\"technicianId\":\"$TECHID\",\"description\":\"Per diem Ndiaye M.\"}")
check "Ndiaye Moussa" "$(jget "$(curl -s $API/expenses/$(echo "$DT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))") -H "$AUTH")" technician.fullName)" "T8 dépense rattachée au technicien"

# ============ T9 : rattachement mission ============
DM=$(curl -s -X POST $API/expenses -H "$AUTH" -H "$J" -d "{\"category\":\"materiel\",\"amount\":9900,\"missionId\":\"$MISID\",\"receiptPhotoUrl\":\"https://cdn/recu-conduite.jpg\",\"description\":\"Conduite 10m\",\"aiExtracted\":true}")
check true "$(jget "$DM" aiExtracted)" "T9 dépense mission avec flag aiExtracted (proposition IA validée)"
DMID=$(echo "$DM" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check "Client Diallo" "$(jget "$(curl -s $API/expenses/$DMID -H "$AUTH")" mission.clientSite)" "T9 dépense rattachée à la mission"

# ============ T10 : synthèse mensuelle par catégorie ============
SUM=$(curl -s "$API/expenses/summary?month=2026-09" -H "$AUTH")
check main_oeuvre "$(jget "$SUM" lines.0.category)" "T10 ligne main_œuvre présente"
check 250000 "$(jget "$SUM" lines.0.total)" "T10 main_œuvre = 250 000"
check 70400 "$(jget "$SUM" lines.1.total)" "T10 matériel = 48 500 + 12 000 + 9 900"
check 32000 "$(jget "$SUM" lines.2.total)" "T10 transport = 32 000"
check 12500 "$(jget "$SUM" lines.3.total)" "T10 divers = 7 500 + 5 000"
check 364900 "$(jget "$SUM" total)" "T10 total général = 364 900"
check 400 "$(code "$API/expenses/summary?month=2026-13" -H "$AUTH")" "T10 mois invalide → 400"

echo "---"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
