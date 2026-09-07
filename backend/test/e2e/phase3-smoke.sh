#!/usr/bin/env bash
# VECTRACOM Phase 3 — Missions & formulaire dynamique : test de bout en bout
# Prérequis : API sur :3100, tenant ONECOMIT actif.
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

# Purge pour un test déterministe
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "DELETE FROM mission_field_reports; DELETE FROM missions;" >/dev/null

# ============ T1 : templates + création mission ============
TPL=$(curl -s $API/mission-templates -H "$AUTH")
check 11 "$(jget "$TPL" length)" "T1 GET /mission-templates → 11 types"
TPLI=$(curl -s $API/mission-templates/INSTALLATION -H "$AUTH")
check 6 "$(jget "$TPLI" steps.length)" "T1 template INSTALLATION → 6 étapes"
check step1_sst "$(jget "$TPLI" steps.0.id)" "T1 étape 1 = SST"

M1=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{
  "clientSite":"Client Diallo - Mbour","typeTache":"INSTALLATION","zone":"Mbour",
  "dateMission":"2026-09-05T08:00:00.000Z","sonatelDossierNumber":"P3-001","sonatelOlt":"O_GMB","sonatelProduit":"FTTH"}')
MID1=$(echo "$M1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$MID1" ] && { PASS=$((PASS+1)); echo "PASS  T1 mission INSTALLATION créée ($MID1)"; } || { FAIL=$((FAIL+1)); echo "FAIL  T1 création mission"; }
check planifiee "$(jget "$M1" status)" "T1 statut initial planifiee"
DUP=$(code -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"X","typeTache":"INSTALLATION","dateMission":"2026-09-05","sonatelDossierNumber":"P3-001"}')
check 400 "$DUP" "T1 doublon de dossier → 400"
BADTYPE=$(code -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"X","typeTache":"INCONNU","dateMission":"2026-09-05"}')
check 400 "$BADTYPE" "T1 type inconnu → 400"

# ============ T2 : 6 étapes + SST bloquant ============
check 400 "$(code -X POST $API/missions/$MID1/field-report/step/2 -H "$AUTH" -H "$J" -d '{"step2":{"interventionType":"nouveau"}}')" "T2 étape 2 avant SST → 400 (bloquant)"
EPI=$(code -X POST $API/missions/$MID1/field-report/step/1 -H "$AUTH" -H "$J" -d '{"step1":{"sstChecklist":{"casque":true,"gants":false}}}')
check 400 "$EPI" "T2 SST avec EPI manquant → 400"
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/1 -H "$AUTH" -H "$J" -d '{"step1":{"sstChecklist":{"casque":true,"gants":true,"chaussures":true,"gilet":true,"lunettes":true},"sstPhotoUrl":"https://cdn/epi.jpg"}}'
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/2 -H "$AUTH" -H "$J" -d '{"step2":{"interventionType":"nouveau","equipmentCode":"B08/D1-4-7","gpsLatitude":14.48623,"gpsLongitude":-17.07876}}'
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/3 -H "$AUTH" -H "$J" -d '{"step3":{"initialEquipmentState":"PBO saturé","actionRealized":"Raccordement FTTH","dbmMeasurement":-18.5}}'
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/4 -H "$AUTH" -H "$J" -d '{"step4":{"photoSiteUrl":"https://cdn/site.jpg","photoPboInteriorUrl":"https://cdn/pbo-int.jpg","photoPboClosedUrl":"https://cdn/pbo-cls.jpg","photoPtoModemUrl":"https://cdn/pto.jpg"}}'
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/5 -H "$AUTH" -H "$J" -d '{"step5":{"materialsConsumed":[{"itemNumber":10,"designation":"Conduite enrobée","quantity":50}]}}'
R6=$(curl -s -X POST $API/missions/$MID1/field-report/step/6 -H "$AUTH" -H "$J" -d '{"step6":{"fieldStatus":"succes","observations":"Raccordement OK","signatureTechnicianUrl":"https://cdn/sig-tech.png","signatureClientUrl":"https://cdn/sig-client.png"}}')
check false "$(jget "$R6" dbmOutOfNorm)" "T2 dbm -18.5 → dans la norme"
check 100.00 "$(jget "$R6" qualityScore)" "T2 score qualité = 100 (photos+dBm+matériel+signatures)"
D1=$(curl -s $API/missions/$MID1 -H "$AUTH")
check terminee "$(jget "$D1" status)" "T2 mission → terminee après étape 6"
check 400 "$(code -X POST $API/missions/$MID1/field-report/step/7 -H "$AUTH" -H "$J" -d '{}')" "T2 étape inconnue → 400 (7 non admis)"

# ============ T3 : validation interne ============
V1=$(curl -s -X POST $API/missions/$MID1/field-report/validate -H "$AUTH" -H "$J" -d '{"internalValidationStatus":"validee"}')
check validee "$(jget "$V1" internalValidationStatus)" "T3 validation interne validee"
check validee "$(jget "$(curl -s $API/missions/$MID1 -H "$AUTH")" status)" "T3 mission → validee"

M2=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Client Sow - Saly","typeTache":"SAV","zone":"Saly","dateMission":"2026-09-05"}')
MID2=$(echo "$M2" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
curl -s -o /dev/null -X POST $API/missions/$MID2/field-report/step/1 -H "$AUTH" -H "$J" -d '{"step1":{"sstChecklist":{"casque":true,"gants":true,"chaussures":true,"gilet":true,"lunettes":true},"sstPhotoUrl":"https://cdn/epi2.jpg"}}'
curl -s -o /dev/null -X POST $API/missions/$MID2/field-report/step/6 -H "$AUTH" -H "$J" -d '{"step6":{"fieldStatus":"echec","failureReason":"PBO inaccessible, clé manquante","signatureTechnicianUrl":"https://cdn/sig2.png"}}'
V2=$(curl -s -X POST $API/missions/$MID2/field-report/validate -H "$AUTH" -H "$J" -d '{"internalValidationStatus":"rejetee"}')
check rejetee "$(jget "$V2" internalValidationStatus)" "T3 validation interne rejetee"
check rejetee "$(jget "$(curl -s $API/missions/$MID2 -H "$AUTH")" status)" "T3 mission → rejetee"

# ============ T4 : approbation SONATEL (distincte) ============
A1=$(curl -s -X POST $API/missions/$MID1/field-report/sonatel-approve -H "$AUTH" -H "$J" -d '{"sonatelApprovalStatus":"approuve"}')
check approuve "$(jget "$A1" sonatelApprovalStatus)" "T4 approbation SONATEL approuve"
check acceptee "$(jget "$A1" recetteStatus)" "T4 recette → acceptee"
check 400 "$(code -X POST $API/missions/$MID2/field-report/sonatel-approve -H "$AUTH" -H "$J" -d '{"sonatelApprovalStatus":"approuve"}')" "T4 approbation sans validation interne → 400"

# ============ T5 : score qualité partiel ============
M3=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Client Ba - Thies","typeTache":"SURVEY","dateMission":"2026-09-06"}')
MID3=$(echo "$M3" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
curl -s -o /dev/null -X POST $API/missions/$MID3/field-report/step/1 -H "$AUTH" -H "$J" -d '{"step1":{"sstChecklist":{"casque":true,"gants":true,"chaussures":true,"gilet":true,"lunettes":true},"sstPhotoUrl":"https://cdn/epi3.jpg"}}'
curl -s -o /dev/null -X POST $API/missions/$MID3/field-report/step/3 -H "$AUTH" -H "$J" -d '{"step3":{"dbmMeasurement":-30}}'
curl -s -o /dev/null -X POST $API/missions/$MID3/field-report/step/4 -H "$AUTH" -H "$J" -d '{"step4":{"photoSiteUrl":"https://cdn/s3.jpg","photoPboInteriorUrl":"https://cdn/p3.jpg"}}'
R5=$(curl -s -X POST $API/missions/$MID3/field-report/step/6 -H "$AUTH" -H "$J" -d '{"step6":{"fieldStatus":"succes","signatureTechnicianUrl":"https://cdn/sig3.png"}}')
check true "$(jget "$R5" dbmOutOfNorm)" "T5 dbm -30 → hors norme"
check 35.00 "$(jget "$R5" qualityScore)" "T5 score partiel = 35 (2 photos 20 + dBm HN 5 + sig tech 10)"

# ============ T6 : PV de recette PDF ============
PV=$(curl -s -D /tmp/pv_headers.txt -o /tmp/pv.pdf -w "%{http_code}" $API/missions/$MID1/pv-recette -H "$AUTH")
check 200 "$PV" "T6 PV de recette → 200"
grep -qi "content-type: application/pdf" /tmp/pv_headers.txt && { PASS=$((PASS+1)); echo "PASS  T6 content-type application/pdf"; } || { FAIL=$((FAIL+1)); echo "FAIL  T6 content-type"; }
head -c 5 /tmp/pv.pdf | grep -q "%PDF" && { PASS=$((PASS+1)); echo "PASS  T6 signature %PDF"; } || { FAIL=$((FAIL+1)); echo "FAIL  T6 signature %PDF"; }
SIZE=$(stat -c%s /tmp/pv.pdf 2>/dev/null || wc -c < /tmp/pv.pdf)
[ "$SIZE" -gt 1000 ] && { PASS=$((PASS+1)); echo "PASS  T6 PDF non trivial (${SIZE} octets)"; } || { FAIL=$((FAIL+1)); echo "FAIL  T6 PDF trop petit"; }
M4=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Client Fall - Dakar","typeTache":"SURVEY","dateMission":"2026-09-07"}')
MID4=$(echo "$M4" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check 400 "$(code $API/missions/$MID4/pv-recette -H "$AUTH")" "T6 PV sur mission non clôturée → 400"

# ============ T7 : liste + filtres + transitions ============
check 200 "$(code $API/missions -H "$AUTH")" "T7 liste sans filtre → 200"
L_TERM=$(curl -s "$API/missions?status=terminee" -H "$AUTH")
check 1 "$(jget "$L_TERM" length)" "T7 filtre status=terminee → 1 (M3)"
L_INST=$(curl -s "$API/missions?typeTache=INSTALLATION" -H "$AUTH")
check 1 "$(jget "$L_INST" length)" "T7 filtre typeTache=INSTALLATION → 1"
L_DATE=$(curl -s "$API/missions?from=2026-09-06T00:00:00.000Z&to=2026-09-06T23:59:59.000Z" -H "$AUTH")
check 1 "$(jget "$L_DATE" length)" "T7 filtre période 06/09 → 1 (M3)"
check 400 "$(code -X PATCH $API/missions/$MID3/status -H "$AUTH" -H "$J" -d '{"status":"en_cours"}')" "T7 transition interdite terminee→en_cours → 400"
curl -s -o /dev/null -X PATCH $API/missions/$MID3/status -H "$AUTH" -H "$J" -d '{"status":"a_completer"}'
check a_completer "$(jget "$(curl -s $API/missions/$MID3 -H "$AUTH")" status)" "T7 transition terminee→a_completer → OK"
curl -s -o /dev/null -X PATCH $API/missions/$MID3/status -H "$AUTH" -H "$J" -d '{"status":"en_cours"}'
check en_cours "$(jget "$(curl -s $API/missions/$MID3 -H "$AUTH")" status)" "T7 transition a_completer→en_cours → OK"

echo "---"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
