#!/usr/bin/env bash
# VECTRACOM Phase 2 — Import SONATEL : test de bout en bout
# Prérequis : API sur :3100, tenant ONECOMIT actif (seed Phase 1), fixtures générées.
set -u
API="http://localhost:3100/api/v1"
DIR="$(cd "$(dirname "$0")" && pwd)"
FIX="$DIR/fixtures"
PASS=0; FAIL=0

check() {
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $3"; else FAIL=$((FAIL+1)); echo "FAIL  $3 (attendu=$1 obtenu=$2)"; fi
}

jget() { node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]}console.log(v===undefined||v===null?'':String(v))" "$1" "$2"; }

# jhas <json> <chemin tableau> <clé> <valeur (\uXXXX pour non-ASCII)> → 1 si présent
jhas() { node -e "const d=JSON.parse(process.argv[1]);const arr=d[process.argv[2]];const val=JSON.parse('\"'+process.argv[3]+'\"');console.log(Array.isArray(arr)&&arr.some(x=>x[process.argv[4]]===val)?1:0)" "$1" "$2" "$4" "$3"; }

code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

# --- Login admin ONECOMIT (tenant SONATEL, sous-traitant 3STB)
LOGIN=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@onecomit.sn","password":"Onecomit!2026"}')
TT=$(echo "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$TT" ] && { PASS=$((PASS+1)); echo "PASS  login admin ONECOMIT"; } || { FAIL=$((FAIL+1)); echo "FAIL  login admin ONECOMIT"; }
AUTH="Authorization: Bearer $TT"

# Purge des missions et mappings du tenant pour un test déterministe
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "DELETE FROM missions;" >/dev/null
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "DELETE FROM sonatel_column_mappings;" >/dev/null

# ================= TEST 1 : aperçu du fichier complet =================
P1=$(curl -s -X POST $API/planning/import/preview -H "$AUTH" -F "file=@$FIX/sonatel_full.xlsx")
FID=$(echo "$P1" | sed -n 's/.*"fileId":"\([^"]*\)".*/\1/p')
check 1 "$([ -n "$FID" ] && echo 1)" "T1 upload → aperçu avec fileId"
check 5 "$(jget "$P1" stats.afterSubcontractorFilter)" "T1 filtrage ST : 5 lignes 3STB gardées (7 lignes au total)"
check 4 "$(jget "$P1" stats.nouvelle)" "T1 statut nouvelle = 4"
check 1 "$(jget "$P1" stats.invalide)" "T1 statut invalide = 1 (sans n° dossier)"
check Alpha "$(jget "$P1" rows.0.team)" "T1 jointure AFFECT : équipe Alpha sur D-001"
check 2 "$(jget "$P1" rows.0.technicians.length)" "T1 jointure AFFECT : 2 techniciens sur D-001"
check 0 "$(jget "$P1" rows.3.technicians.length)" "T1 D-004 sans affectation → 0 technicien"
check true "$(jget "$P1" affectSheetFound)" "T1 affectSheetFound=true"
[ "$(jget "$P1" affectSheetFound)" = "true" ] && { PASS=$((PASS+1)); echo "PASS  T1 onglet AFFECT détecté"; } || { FAIL=$((FAIL+1)); echo "FAIL  T1 onglet AFFECT détecté"; }

# ================= TEST 2 : confirmation → création =================
C1=$(curl -s -X POST $API/planning/import/confirm -H "$AUTH" -H "Content-Type: application/json" -d "{\"fileId\":\"$FID\"}")
check 4 "$(jget "$C1" created)" "T2 confirm → 4 missions créées"
check 0 "$(jget "$C1" updated)" "T2 confirm → 0 mise à jour"
DB=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM missions;")
check 4 "$DB" "T2 base : 4 missions en table"

# ================= TEST 3 : idempotence (ré-import) =================
P2=$(curl -s -X POST $API/planning/import/preview -H "$AUTH" -F "file=@$FIX/sonatel_full.xlsx")
FID2=$(echo "$P2" | sed -n 's/.*"fileId":"\([^"]*\)".*/\1/p')
check 0 "$(jget "$P2" stats.nouvelle)" "T3 ré-import → 0 nouvelle (doublons détectés)"
check 4 "$(jget "$P2" stats.mise_a_jour)" "T3 ré-import → 4 mise_a_jour"
C2=$(curl -s -X POST $API/planning/import/confirm -H "$AUTH" -H "Content-Type: application/json" -d "{\"fileId\":\"$FID2\"}")
check 0 "$(jget "$C2" created)" "T3 ré-confirm → 0 création"
check 4 "$(jget "$C2" updated)" "T3 ré-confirm → 4 mises à jour"
DB=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM missions;")
check 4 "$DB" "T3 base toujours 4 missions (aucun doublon)"

# Idempotence renforcée : mission terminée → ignorée au ré-import
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "UPDATE missions SET status='terminee' WHERE sonatel_dossier_number='D-001';"
P3=$(curl -s -X POST $API/planning/import/preview -H "$AUTH" -F "file=@$FIX/sonatel_full.xlsx")
check 1 "$(jget "$P3" stats.ignoree)" "T3 mission terminée → statut ignorée"

# ================= TEST 4 : fichier sans AFFECT =================
P4=$(curl -s -X POST $API/planning/import/preview -H "$AUTH" -F "file=@$FIX/sonatel_noaffect.xlsx")
FID4=$(echo "$P4" | sed -n 's/.*"fileId":"\([^"]*\)".*/\1/p')
check false "$(jget "$P4" affectSheetFound)" "T4 onglet AFFECT absent détecté"
check 2 "$(jget "$P4" stats.nouvelle)" "T4 2 nouvelles missions"
C4=$(curl -s -X POST $API/planning/import/confirm -H "$AUTH" -H "Content-Type: application/json" -d "{\"fileId\":\"$FID4\"}")
check 2 "$(jget "$C4" created)" "T4 confirm → 2 créées"
TECH=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM missions WHERE sonatel_dossier_number IN ('D-201','D-202') AND technician_ids='{}' AND (import_meta->>'teamLabel') IS NULL;")
check 2 "$TECH" "T4 missions sans AFFECT → technicianIds vide, pas d'équipe"

# ================= TEST 5 : mapping par défaut exposé =================
M1=$(curl -s $API/planning/import/mappings -H "$AUTH")
check true "$(jget "$M1" usingDefaults)" "T5 GET mappings → défauts SONATEL"
check Demande "$(jget "$M1" planning.0.sourceColumnName)" "T5 défaut planning : colonne Demande→dossierNumber"
check true "$([ "$(jget "$M1" planning.0.targetField)" = "dossierNumber" ] && echo true)" "T5 cible dossierNumber"

# ================= TEST 6 : mapping personnalisé + fichier renommé =================
# Avant mapping : le fichier renommé ne résolve pas « N° Demande » → tout invalide
P5=$(curl -s -X POST $API/planning/import/preview -H "$AUTH" -F "file=@$FIX/sonatel_renamed.xlsx")
check 5 "$(jget "$P5" stats.invalide)" "T6 sans mapping personnalisé → 5 lignes invalides"

# PUT : remplacement du mapping planning avec la colonne renommée.
# Le JSON est écrit par node dans un fichier (UTF-8 fiable) : le shell ne
# transporte pas « ° » sans corruption, curl lit ensuite le fichier tel quel.
MAPFILE="$FIX/mapping_custom.json"
node -e 'require("fs").writeFileSync(process.argv[1], JSON.stringify({mappings:[
 {sheetType:"planning",sourceColumnName:"N\u00b0 Demande",targetField:"dossierNumber"},
 {sheetType:"planning",sourceColumnName:"Client",targetField:"client"},
 {sheetType:"planning",sourceColumnName:"Tache",targetField:"task"},
 {sheetType:"planning",sourceColumnName:"Zone",targetField:"zone"},
 {sheetType:"planning",sourceColumnName:"Date",targetField:"dateMission"},
 {sheetType:"planning",sourceColumnName:"OLT",targetField:"olt"},
 {sheetType:"planning",sourceColumnName:"Produit",targetField:"produit"},
 {sheetType:"planning",sourceColumnName:"ST",targetField:"subcontractor"}]}))' "$MAPFILE"
PUT=$(curl -s -X PUT $API/planning/import/mappings -H "$AUTH" -H "Content-Type: application/json" -d @"$MAPFILE")
check false "$(jget "$PUT" usingDefaults)" "T6 PUT mappings → défauts remplacés"
M2=$(curl -s $API/planning/import/mappings -H "$AUTH")
check 1 "$(jhas "$M2" planning sourceColumnName 'N\u00b0 Demande')" "T6 mapping « N° Demande » persisté par tenant"

# D-001..004 existent déjà en base (T2/T3, D-001 terminée) → colonnes résolues :
# 1 invalide (ligne sans n° de dossier), 3 mise_a_jour, 1 ignorée ; AFFECT joint sur D-001.
P6=$(curl -s -X POST $API/planning/import/preview -H "$AUTH" -F "file=@$FIX/sonatel_renamed.xlsx")
check 1 "$(jget "$P6" stats.invalide)" "T6 avec mapping personnalisé → 1 invalide (ligne sans n° dossier)"
check 3 "$(jget "$P6" stats.mise_a_jour)" "T6 avec mapping personnalisé → 3 mise_a_jour"
check 1 "$(jget "$P6" stats.ignoree)" "T6 avec mapping personnalisé → 1 ignorée (D-001 terminée)"
check Alpha "$(jget "$P6" rows.0.team)" "T6 AFFECT toujours résolu via mapping défaut affect"

# Restauration du mapping par défaut pour les phases suivantes
curl -s -X PUT $API/planning/import/mappings -H "$AUTH" -H "Content-Type: application/json" -d '{
  "mappings": [
    { "sheetType": "planning", "sourceColumnName": "Demande", "targetField": "dossierNumber" },
    { "sheetType": "planning", "sourceColumnName": "Client", "targetField": "client" },
    { "sheetType": "planning", "sourceColumnName": "Tache", "targetField": "task" },
    { "sheetType": "planning", "sourceColumnName": "Zone", "targetField": "zone" },
    { "sheetType": "planning", "sourceColumnName": "Date", "targetField": "dateMission" },
    { "sheetType": "planning", "sourceColumnName": "OLT", "targetField": "olt" },
    { "sheetType": "planning", "sourceColumnName": "Produit", "targetField": "produit" },
    { "sheetType": "planning", "sourceColumnName": "ST", "targetField": "subcontractor" }
  ]
}' >/dev/null

# ================= TEST 7 : sécurité =================
check 401 "$(code -X POST $API/planning/import/preview)" "T7 import sans token → 401"
GT=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@green-t.sn","password":"ChangeMe!2026"}' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
check 400 "$(code -X POST $API/planning/import/preview -H "Authorization: Bearer $GT" -F "file=@$FIX/sonatel_full.xlsx")" "T7 super_admin (hors tenant) → refusé"
check 200 "$(code $API/planning/missions -H "$AUTH")" "T7 GET /planning/missions → 200"

echo "---"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
