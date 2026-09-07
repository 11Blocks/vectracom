#!/usr/bin/env bash
# VECTRACOM Phase 4 — Équipes & Techniciens : test de bout en bout
# Prérequis : API sur :3100, tenant ONECOMIT actif, fixtures Phase 2 générées.
set -u
API="http://localhost:3100/api/v1"
FIX="$(cd "$(dirname "$0")" && pwd)/fixtures"
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

# Purge déterministe : missions libérées des équipes, puis techniciens et équipes
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "DELETE FROM mission_field_reports; DELETE FROM missions; DELETE FROM technicians; DELETE FROM teams;" >/dev/null

# ============ T1 : création équipes (4 types) + filtres ============
T_PROD=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD","zone":"Mbour"}')
TID1=$(echo "$T_PROD" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$TID1" ] && { PASS=$((PASS+1)); echo "PASS  T1 équipe PROD créée"; } || { FAIL=$((FAIL+1)); echo "FAIL  T1 équipe PROD"; }
curl -s -o /dev/null -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Beta","type":"SAV","zone":"Saly"}'
curl -s -o /dev/null -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Gamma","type":"INFRA","zone":"Thies"}'
TD=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Delta","type":"EXTENSION","zone":"Dakar"}')
TID4=$(echo "$TD" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check 4 "$(jget "$(curl -s $API/teams -H "$AUTH")" length)" "T1 GET /teams → 4 équipes"
check 1 "$(jget "$(curl -s "$API/teams?type=EXTENSION" -H "$AUTH")" length)" "T1 filtre type=EXTENSION → 1"
check 1 "$(jget "$(curl -s "$API/teams?zone=Mbour" -H "$AUTH")" length)" "T1 filtre zone=Mbour → 1"
check 409 "$(code -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD"}')" "T1 doublon de nom → 409"
check 400 "$(code -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"X1","type":"INCONNU"}')" "T1 type inconnu → 400"

# ============ T2 : technicien avec compétences ============
P1=$(curl -s -X POST $API/technicians -H "$AUTH" -H "$J" -d "{
  \"fullName\":\"Ndiaye Moussa\",\"phone\":\"771234567\",\"teamId\":\"$TID1\",
  \"isTeamLeader\":true,\"experienceYears\":6,\"contractType\":\"CDI\",
  \"competences\":[\"DEPLOIEMENT\",\"DENSIF\"],
  \"habilitationSstExpiration\":\"2027-03-15\",\"habilitationConduiteExpiration\":\"2026-12-01\",
  \"documents\":[{\"type\":\"CNI\",\"fileUrl\":\"https://cdn/cni.pdf\"}]}")
PID1=$(echo "$P1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$PID1" ] && { PASS=$((PASS+1)); echo "PASS  T2 technicien créé"; } || { FAIL=$((FAIL+1)); echo "FAIL  T2 création"; }
check true "$(jget "$P1" isTeamLeader)" "T2 isTeamLeader=true"
check 2 "$(jget "$P1" competences.length)" "T2 compétences stockées (2)"
check CDI "$(jget "$P1" contractType)" "T2 type contrat CDI"
check 1 "$(jget "$(curl -s "$API/technicians?competence=DENSIF" -H "$AUTH")" length)" "T2 filtre compétence=DENSIF → 1"
check 0 "$(jget "$(curl -s "$API/technicians?competence=OSM" -H "$AUTH")" length)" "T2 filtre compétence=OSM → 0"
check 400 "$(code -X POST $API/technicians -H "$AUTH" -H "$J" -d '{"fullName":"X Y","teamId":"00000000-0000-0000-0000-000000000000"}')" "T2 équipe inconnue → 400"

# ============ T3 : binôme chef / second ============
P2=$(curl -s -X POST $API/technicians -H "$AUTH" -H "$J" -d "{
  \"fullName\":\"Sow Abdallahi\",\"phone\":\"776543210\",\"teamId\":\"$TID1\",
  \"isTeamLeader\":false,\"teamLeaderId\":\"$PID1\",\"experienceYears\":3,\"contractType\":\"CDD\",
  \"competences\":[\"DEPLOIEMENT\"]}")
PID2=$(echo "$P2" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check "$PID1" "$(jget "$(curl -s $API/technicians/$PID2 -H "$AUTH")" teamLeader.id)" "T3 binôme rattaché au chef (teamLeaderId résolu)"
check 2 "$(jget "$(curl -s "$API/technicians/by-team/$TID1" -H "$AUTH")" length)" "T3 GET by-team → 2 techniciens"
check 1 "$(jget "$(curl -s $API/technicians/leaders -H "$AUTH")" length)" "T3 GET leaders → 1 chef"
check "$PID1" "$(jget "$(curl -s "$API/technicians/by-team/$TID1" -H "$AUTH")" 0.id)" "T3 chef listé en premier (isTeamLeader DESC)"
check 400 "$(code -X PUT $API/technicians/$PID1 -H "$AUTH" -H "$J" -d "{\"teamLeaderId\":\"$PID1\"}")" "T3 auto-référence binôme → 400"

# ============ T4 : mise à jour habilitations ============
U1=$(curl -s -X PUT $API/technicians/$PID1 -H "$AUTH" -H "$J" -d '{"habilitationSstExpiration":"2027-09-30","habilitationConduiteExpiration":null}')
check 2027-09-30 "$(jget "$U1" habilitationSstExpiration)" "T4 habilitation SST mise à jour"
check "" "$(jget "$U1" habilitationConduiteExpiration)" "T4 habilitation conduite effaçable (null)"

# ============ T5 : résolution libellés d'import (Phase 2) ============
P5=$(curl -s -X POST $API/planning/import/preview -H "$AUTH" -F "file=@$FIX/sonatel_full.xlsx")
FID5=$(echo "$P5" | sed -n 's/.*"fileId":"\([^"]*\)".*/\1/p')
C5=$(curl -s -X POST $API/planning/import/confirm -H "$AUTH" -H "$J" -d "{\"fileId\":\"$FID5\"}")
check 4 "$(jget "$C5" created)" "T5 import confirmé → 4 missions"
# D-001 : équipe Alpha + Ndiaye M., Sow A. (prénoms abrégés)
DB5=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "
SELECT t.name || '|' || COALESCE(cardinality(m.technician_ids), 0) || '|' || COALESCE(m.team_id::text,'')
FROM missions m LEFT JOIN teams t ON t.id = m.team_id
WHERE m.sonatel_dossier_number='D-001';")
TEAM_NAME="${DB5%%|*}"; REST="${DB5#*|}"; TECH_COUNT="${REST%%|*}"; TEAM_FK="${REST#*|}"
check Alpha "$TEAM_NAME" "T5 D-001 → teamId résolu vers l'équipe Alpha"
check 2 "$TECH_COUNT" "T5 D-001 → 2 techniciens résolus (Ndiaye M., Sow A.)"
[ "$TEAM_FK" != "" ] && [ "$TEAM_FK" != "null" ] && { PASS=$((PASS+1)); echo "PASS  T5 FK team_id renseignée"; } || { FAIL=$((FAIL+1)); echo "FAIL  T5 FK team_id"; }
# Équipe Gamma (AFFECT) créée par le résolveur si absente
check 1 "$(jget "$(curl -s "$API/teams?zone=Thies" -H "$AUTH")" length)" "T5 équipe Gamma du fichier AFFECT résolée/créée"
# Binôme importé rattaché à la bonne équipe
GAMMA_ID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM teams WHERE name='Gamma';")
check 2 "$(jget "$(curl -s "$API/technicians/by-team/$GAMMA_ID" -H "$AUTH")" length)" "T5 techniciens Gamma (Fall S., Ba O.) créés et rattachés"

# ============ T7 : suppression équipe avec techniciens (RESTRICT) ============
check 409 "$(code -X DELETE $API/teams/$TID1 -H "$AUTH")" "T7 suppression équipe avec techniciens → 409 (RESTRICT)"
check 200 "$(code -X PUT $API/teams/$TID1 -H "$AUTH" -H "$J" -d '{"active":false}')" "T7 désactivation équipe possible"

# ============ T8 : suppression techniciens (détachement binôme + missions) ============
MID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM missions WHERE sonatel_dossier_number='D-001';")
BEFORE=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM missions WHERE id='$MID' AND '$PID1' = ANY(technician_ids);")
check 1 "$BEFORE" "T8 prérequis : chef référencé dans la mission"
D2=$(curl -s -X DELETE $API/technicians/$PID2 -H "$AUTH")
check true "$(jget "$D2" deleted)" "T8 suppression binôme"
DETACH=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM technicians WHERE team_leader_id='$PID1';")
check 0 "$DETACH" "T8 aucun binôme orphelin restant"
D1=$(curl -s -X DELETE $API/technicians/$PID1 -H "$AUTH")
check true "$(jget "$D1" deleted)" "T8 suppression chef"
AFTER=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM missions WHERE id='$MID' AND '$PID1' = ANY(technician_ids);")
check 0 "$AFTER" "T8 chef retiré de technician_ids des missions"

# Puis l'équipe devient supprimable
check 200 "$(code -X DELETE $API/teams/$TID1 -H "$AUTH")" "T7/T8 équipe supprimable une fois vidée"

echo "---"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
