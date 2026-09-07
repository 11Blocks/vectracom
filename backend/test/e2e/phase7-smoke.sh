#!/usr/bin/env bash
# VECTRACOM Phase 7 — Conformité & Fiches de chantier : test de bout en bout
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

# Purge déterministe
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
DELETE FROM site_checklist_templates;
DELETE FROM compliance_checklist_templates;
DELETE FROM compliance_records;
DELETE FROM company_compliance_documents;
DELETE FROM mission_field_reports;
DELETE FROM missions;" >/dev/null
# Bordereau 3STB requis (Phase 5)
cd "C:\Users\USER\green_T_4/VECTRACOM 1.0/backend"
docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM price_items WHERE version='2025';" | grep -q "^52$" || npx ts-node scripts/seed-price-items.ts >/dev/null 2>&1
cd - >/dev/null

# ============ T1 : checklists paramétrables ============
CK1=$(curl -s -X POST $API/compliance/checklists -H "$AUTH" -H "$J" -d '{"missionType":"INSTALLATION","items":[{"label":"EPI complets portés","required":true},{"label":"Balisage zone","required":true},{"label":"Photos avant/après","required":false}]}')
CKID1=$(echo "$CK1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check INSTALLATION "$(jget "$CK1" missionType)" "T1 checklist INSTALLATION créée"
curl -s -o /dev/null -X POST $API/compliance/checklists -H "$AUTH" -H "$J" -d '{"missionType":"SAV","items":[{"label":"Diagnostic documenté","required":true},{"label":"Test service","required":true}]}'
curl -s -o /dev/null -X POST $API/compliance/checklists -H "$AUTH" -H "$J" -d '{"missionType":"OSM","items":[{"label":"Autorisation travaux","required":true},{"label":"Dossier mesure fibre","required":true}]}'
curl -s -o /dev/null -X POST $API/compliance/checklists -H "$AUTH" -H "$J" -d '{"missionType":"FTTH","items":[{"label":"Mesure dBm","required":true}]}' # type libre (pas limité aux 11)
check 4 "$(jget "$(curl -s $API/compliance/checklists -H "$AUTH")" length)" "T1 liste → 4 checklists (dont type libre FTTH)"
check 409 "$(code -X POST $API/compliance/checklists -H "$AUTH" -H "$J" -d '{"missionType":"INSTALLATION","items":[{"label":"Doublon test","required":true}]}')" "T1 doublon de type → 409"
UP=$(curl -s -X PUT $API/compliance/checklists/$CKID1 -H "$AUTH" -H "$J" -d '{"items":[{"label":"EPI complets portés","required":true},{"label":"Balisage zone","required":true},{"label":"Propreté site","required":true}]}')
check 3 "$(jget "$UP" items.length)" "T1 mise à jour des items"

# ============ T2 : record de conformité par équipe ============
TEAM=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD","zone":"Mbour"}')
TEAMID=$(echo "$TEAM" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
if [ -z "$TEAMID" ]; then TEAMID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM teams WHERE name='Alpha' LIMIT 1;"); fi
R1=$(curl -s -X POST $API/compliance/records -H "$AUTH" -H "$J" -d "{\"teamId\":\"$TEAMID\"}")
RID=$(echo "$R1" | sed -n 's/^{"id":"\([^"]*\)".*/\1/p')
check incomplet "$(jget "$R1" status)" "T2 record créé (statut initial incomplet)"
check Alpha "$(jget "$R1" team.name)" "T2 record lié à l'équipe Alpha"
check 409 "$(code -X POST $API/compliance/records -H "$AUTH" -H "$J" -d "{\"teamId\":\"$TEAMID\"}")" "T2 unicité (companyId, teamId) → 409"

# ============ T3 : statut du record ============
R2=$(curl -s -X PUT $API/compliance/records/$RID -H "$AUTH" -H "$J" -d '{"status":"valide","observations":"Dossier complet, habilitations à jour"}')
check valide "$(jget "$R2" status)" "T3 statut mis à jour → valide"
check 1 "$(jget "$(curl -s "$API/compliance/records?status=valide" -H "$AUTH")" length)" "T3 filtre par statut → 1"
R3=$(curl -s -X PUT $API/compliance/records/$RID -H "$AUTH" -H "$J" -d '{"status":"a_corriger","observations":"Habilitations SST expirées pour 1 technicien"}')
check a_corriger "$(jget "$R3" status)" "T3 statut a_corriger"

# ============ T4 : documents contractuels (3 piliers) ============
D1=$(curl -s -X POST $API/compliance/documents -H "$AUTH" -H "$J" -d '{"docType":"code_conduite","fileUrl":"https://cdn/code-conduite-signed.pdf","signed":true,"signedAt":"2026-01-15"}')
check code_conduite "$(jget "$D1" docType)" "T4 Code de Conduite ajouté"
check true "$(jget "$D1" signed)" "T4 document signé"
curl -s -o /dev/null -X POST $API/compliance/documents -H "$AUTH" -H "$J" -d '{"docType":"charte_sst","fileUrl":"https://cdn/charte-sst.pdf"}'
curl -s -o /dev/null -X POST $API/compliance/documents -H "$AUTH" -H "$J" -d '{"docType":"dechets_d3e","fileUrl":"https://cdn/d3e.pdf"}'
check 3 "$(jget "$(curl -s $API/compliance/documents -H "$AUTH")" length)" "T4 les 3 piliers présents"
SUM=$(curl -s $API/compliance/contract-summary -H "$AUTH")
check false "$(jget "$SUM" complete)" "T4 synthèse incomplète (SST et D3E non signés)"
DID1=$(echo "$D1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
curl -s -o /dev/null -X PUT $API/compliance/documents/$DID1 -H "$AUTH" -H "$J" -d '{"signed":false,"signedAt":null}'
check 400 "$(code -X POST $API/compliance/documents -H "$AUTH" -H "$J" -d '{"docType":"permis","fileUrl":"https://cdn/x.pdf"}')" "T4 type de document inconnu → 400"

# ============ T5 : template OSM ============
T_OSM=$(curl -s -X POST $API/site-checklists/templates -H "$AUTH" -H "$J" -d '{
  "templateType":"OSM","label":"Fiche OSM ONECOMIT","description":"Liaison spécialisée",
  "sections":[
    {"section":"Identification","items":[{"id":"olt","label":"OLT","type":"text"},{"id":"demande","label":"Demande","type":"text"}]},
    {"section":"Travaux","items":[
      {"id":"tirageSouterrain","label":"Tirage transport souterrain","type":"number","unit":"m","priceItem":42},
      {"id":"raccordementOsm","label":"Raccordement liaison OSM","type":"number","unit":"u","priceItem":41},
      {"id":"soudure","label":"Soudure fibre","type":"number","unit":"brin","priceItem":30}]}],
  "requiredPhotos":[{"type":"depart","label":"Photo départ","count":1}]}')
check OSM "$(jget "$T_OSM" templateType)" "T5 template OSM créé"
check 42 "$(jget "$T_OSM" sections.1.items.0.priceItem)" "T5 item lié au bordereau (priceItem 42)"
GET_OSM=$(curl -s $API/site-checklists/templates/OSM -H "$AUTH")
check "Fiche OSM ONECOMIT" "$(jget "$GET_OSM" label)" "T5 GET par type"

# ============ T6 : template GC + seed DENSIF/SURVEY_OSM ============
T_GC=$(curl -s -X POST $API/site-checklists/templates -H "$AUTH" -H "$J" -d '{
  "templateType":"GC","label":"Fiche GC ONECOMIT",
  "sections":[{"section":"Travaux","items":[
    {"id":"conduiteEnrobee","label":"Conduite enrobée","type":"number","unit":"m","priceItem":10},
    {"id":"chambreL2t","label":"Chambre BPE L2T","type":"number","unit":"u","priceItem":16}]}]}')
check GC "$(jget "$T_GC" templateType)" "T6 template GC créé"
cd "C:\Users\USER\green_T_4/VECTRACOM 1.0/backend" && npx ts-node scripts/seed-site-checklist-templates.ts >/dev/null 2>&1; cd - >/dev/null
TPLS=$(curl -s $API/site-checklists/templates -H "$AUTH")
check 4 "$(jget "$TPLS" length)" "T6 seed : 4 templates (OSM, GC, DENSIF, SURVEY_OSM)"
check 400 "$(code -X POST $API/site-checklists/templates -H "$AUTH" -H "$J" -d '{"templateType":"OSM","label":"Doublon","sections":[{"section":"S","items":[{"id":"x","label":"X","type":"text"}]}]}')" "T6 doublon de type → 400"
check 400 "$(code -X POST $API/site-checklists/templates -H "$AUTH" -H "$J" -d '{"templateType":"XYZ","label":"Inconnu","sections":[{"section":"S","items":[{"id":"x","label":"X","type":"text"}]}]}')" "T6 type de fiche inconnu → 400"

# ============ T7/T8 : fiche chantier d'une mission + bordereau ============
M=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Mosquée Touba — DSI","typeTache":"OSM","zone":"Touba","dateMission":"2026-09-12","sonatelDossierNumber":"P7-OSM-001"}')
MID=$(echo "$M" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
G1=$(curl -s $API/site-checklists/$MID -H "$AUTH")
check true "$(jget "$G1" applicable)" "T7 fiche applicable (mission OSM)"
check OSM "$(jget "$G1" templateType)" "T7 template OSM proposé"
check "" "$(jget "$G1" saved)" "T7 rien encore sauvegardé"

# Sauvegarde avec valorisation bordereau : 50 m × item 42 (950) + 1 u × item 41 (45000) = 92500
S1=$(curl -s -X POST $API/site-checklists/$MID -H "$AUTH" -H "$J" -d '{
  "data":{"olt":"O_TBA","demande":"DEM-2026-118","tirageSouterrain":50,"raccordementOsm":1},
  "photos":[{"type":"depart","url":"https://cdn/osm-depart.jpg"}],
  "priceItems":[{"itemNumber":42,"quantity":50},{"itemNumber":41,"quantity":1}]}')
check OSM "$(jget "$S1" templateType)" "T8 fiche sauvegardée pour la mission"
check 92500 "$(jget "$S1" montantTotal)" "T8 montant valorisé via bordereau (50×950 + 1×45000)"
check 950 "$(jget "$S1" priceItemsUsed.0.unitPrice)" "T8 prix unitaire résolu depuis price_items"
DB_M=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT montant_total FROM mission_field_reports WHERE mission_id='$MID';")
check 92500 "$(echo $DB_M | sed 's/\.00$//;s/,00$//')" "T8 montant_total persisté dans le rapport terrain"
G2=$(curl -s $API/site-checklists/$MID -H "$AUTH")
check O_TBA "$(jget "$G2" saved.data.olt)" "T7 données relues via GET"

# Mission sans fiche → non applicable
M2=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Client X","typeTache":"INSTALLATION","dateMission":"2026-09-12"}')
MID2=$(echo "$M2" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check false "$(jget "$(curl -s $API/site-checklists/$MID2 -H "$AUTH")" applicable)" "T7 INSTALLATION → pas de fiche (applicable=false)"
check 400 "$(code -X POST $API/site-checklists/$MID2 -H "$AUTH" -H "$J" -d '{"data":{}}')" "T7 sauvegarde refusée pour type sans fiche → 400"

echo "---"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
