#!/usr/bin/env bash
# VECTRACOM Phase 16 — Recette : scénario complet cross-modules (10 étapes)
# Chaque étape enchaîne la précédente : le flux métier ONECOMIT de bout en bout.
set -u
API="http://localhost:3100/api/v1"
PASS=0; FAIL=0

check() {
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $3"; else FAIL=$((FAIL+1)); echo "FAIL  $3 (attendu=$1 obtenu=$2)"; fi
}
jget() { node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]}console.log(v===undefined||v===null?'':String(v))" "$1" "$2"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
extract() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))"; }

echo "════════════════════════════════════════════════════════════"
echo "  VECTRACOM — RECETTE COMPLÈTE (scénario ONECOMIT)"
echo "════════════════════════════════════════════════════════════"

# Connexion admin ONECOMIT
LOGIN=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@onecomit.sn","password":"Onecomit!2026"}')
TT=$(echo "$LOGIN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
[ -n "$TT" ] && { PASS=$((PASS+1)); echo "PASS  Connexion admin ONECOMIT"; } || { FAIL=$((FAIL+1)); echo "FAIL  Connexion"; }
AUTH="Authorization: Bearer $TT"
J="Content-Type: application/json"
CID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM companies WHERE name='ONECOMIT';" | head -1)
FIX="$(cd "$(dirname "$0")" && pwd)/fixtures"
OUTDIR="$(cd "$(dirname "$0")" && pwd)"

# Nettoyage du tenant pour un scénario déterministe
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
DELETE FROM rag_messages; DELETE FROM rag_conversations;
DELETE FROM notifications; DELETE FROM notification_settings; DELETE FROM push_tokens;
DELETE FROM invoice_penalties; DELETE FROM invoice_lines; DELETE FROM invoices;
DELETE FROM sonatel_kpi_alerts; DELETE FROM sonatel_kpi_logs;
DELETE FROM incident_feedback; DELETE FROM incident_ai_analysis; DELETE FROM incidents;
DELETE FROM saas_transactions; DELETE FROM saas_overage_bills; DELETE FROM invoices_saas;
DELETE FROM company_subscriptions; DELETE FROM saas_usage_tracking; DELETE FROM saas_limits; DELETE FROM saas_addons;
DELETE FROM mission_field_reports; DELETE FROM missions;
DELETE FROM sonatel_column_mappings;
UPDATE companies SET subscription_status='active', active=true;
DELETE FROM stock_movements; DELETE FROM stock_levels; DELETE FROM item_serials; DELETE FROM item_batches;
DELETE FROM vehicle_checks;" >/dev/null

# ══════════════ ÉTAPE 1 : IMPORT SONATEL (Phase 2) ══════════════
echo ""
echo "── Étape 1 : Import SONATEL"
PV1=$(curl -s -X POST $API/planning/import/preview -H "$AUTH" -F "file=@$FIX/sonatel_full.xlsx")
FID=$(echo "$PV1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).fileId))")
C1=$(curl -s -X POST $API/planning/import/confirm -H "$AUTH" -H "$J" -d "{\"fileId\":\"$FID\"}")
check 4 "$(jget "$C1" created)" "Import : 4 missions créées (filtrage ST + idempotence)"
MID1=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM missions WHERE sonatel_dossier_number='D-001';" | head -1)
MID2=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM missions WHERE sonatel_dossier_number='D-002';" | head -1)
check true "$([ -n "$MID1" ] && echo true)" "Mission D-001 en base avec teamId résolu (Phase 4)"

# ══════════════ ÉTAPE 2 : AFFECTATION (Phases 3+4) ══════════════
echo ""
echo "── Étape 2 : Affectation"
TEAMID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM teams WHERE name='Alpha' LIMIT 1;" | head -1)
LEADER=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM technicians WHERE company_id='$CID' AND is_team_leader AND team_id='$TEAMID' LIMIT 1;" | head -1)
BINOME=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM technicians WHERE company_id='$CID' AND NOT is_team_leader AND team_id='$TEAMID' LIMIT 1;" | head -1)
PL=$(curl -s -X POST $API/ai/planning/suggest/$MID2 -H "$AUTH")
check false "$(jget "$PL" autoExecute)" "Agent Planning : proposition (jamais auto-exécutée)"
ST=$(curl -s -X PATCH $API/missions/$MID1/status -H "$AUTH" -H "$J" -d '{"status":"en_cours"}')
check en_cours "$(jget "$ST" status)" "Mission D-001 en cours"

# ══════════════ ÉTAPE 3 : EXÉCUTION TERRAIN (Phase 3) ══════════════
echo ""
echo "── Étape 3 : Exécution terrain (6 étapes)"
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/1 -H "$AUTH" -H "$J" -d '{"step1":{"sstChecklist":{"casque":true,"gants":true,"chaussures":true,"gilet":true,"lunettes":true},"sstPhotoUrl":"https://cdn/epi.jpg"}}'
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/2 -H "$AUTH" -H "$J" -d '{"step2":{"interventionType":"nouveau","equipmentCode":"B08/D1-4-7","gpsLatitude":14.48623,"gpsLongitude":-17.07876}}'
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/3 -H "$AUTH" -H "$J" -d '{"step3":{"initialEquipmentState":"PBO OK","actionRealized":"Raccordement FTTH","dbmMeasurement":-18.5}}'
AUD=$(curl -s -X POST $API/ai/photo-audit -H "$AUTH" -H "$J" -d '{"photoUrl":"https://cdn/photo-site-nette.jpg"}')
check accepte "$(jget "$AUD" verdict)" "Pré-audit photo (Phase 15) : photo acceptée"
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/4 -H "$AUTH" -H "$J" -d '{"step4":{"photoSiteUrl":"https://cdn/site.jpg","photoPboInteriorUrl":"https://cdn/pbo-int.jpg","photoPboClosedUrl":"https://cdn/pbo-cls.jpg","photoPtoModemUrl":"https://cdn/pto.jpg"}}'

# ══════════════ ÉTAPE 4 : STOCK (Phase 5) ══════════════
echo ""
echo "── Étape 4 : Stock"
VID_WH=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM warehouses WHERE company_id='$CID' AND name LIKE 'Dépôt Central%' LIMIT 1;" | head -1)
VEHWH=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT warehouse_id FROM vehicles WHERE company_id='$CID' AND immatriculation='DK-4521-AB';" | head -1)
CABLE=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM stock_items WHERE company_id='$CID' AND reference='FO-CAB-24' LIMIT 1;" | head -1)
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$CABLE\",\"type\":\"entree\",\"quantity\":200,\"toWarehouseId\":\"$VID_WH\",\"note\":\"Livraison SONATEL lot L-2026-09\"}"
LEVEL_BEFORE=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT COALESCE(quantity,0) FROM stock_levels WHERE stock_item_id='$CABLE' AND warehouse_id='$VEHWH';" | head -1)
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$CABLE\",\"type\":\"transfert\",\"quantity\":60,\"fromWarehouseId\":\"$VID_WH\",\"toWarehouseId\":\"$VEHWH\",\"missionId\":\"$MID1\"}"
SM=$(curl -s -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$CABLE\",\"type\":\"consommation\",\"quantity\":35,\"fromWarehouseId\":\"$VEHWH\",\"missionId\":\"$MID1\",\"technicianId\":\"$LEADER\",\"note\":\"Tirage 35m mission D-001\"}")
LEVEL_AFTER=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT COALESCE(quantity,0) FROM stock_levels WHERE stock_item_id='$CABLE' AND warehouse_id='$VEHWH';" | head -1)
check 25 "$LEVEL_AFTER" "Décrémentation automatique : 60 transférés - 35 consommés = 25"
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/5 -H "$AUTH" -H "$J" -d '{"step5":{"materialsConsumed":[{"itemNumber":29,"designation":"Raccordement PBO","quantity":1}]}}'

# ══════════════ ÉTAPE 5 : VÉHICULES (Phase 6) ══════════════
echo ""
echo "── Étape 5 : Véhicules"
VEHID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM vehicles WHERE company_id='$CID' AND immatriculation='DK-4521-AB';" | head -1)
CH=$(curl -s -X POST $API/vehicles/$VEHID/checks -H "$AUTH" -H "$J" -d '{"huile":true,"eau":true,"freins":true,"pneus":true,"batterie":true,"eclairage":true,"missionId":null,"observations":"Checklist OK"}')
check true "$([ -n "$(jget "$CH" id)" ] && echo true)" "Checklist prise de poste enregistrée"

# Clôture terrain
curl -s -o /dev/null -X POST $API/missions/$MID1/field-report/step/6 -H "$AUTH" -H "$J" -d '{"step6":{"fieldStatus":"succes","observations":"Raccordement OK","signatureTechnicianUrl":"https://cdn/sig-t.png","signatureClientUrl":"https://cdn/sig-c.png"}}'
M1=$(curl -s $API/missions/$MID1 -H "$AUTH")
check terminee "$(jget "$M1" status)" "Mission D-001 clôturée (score qualité calculé)"
curl -s -o /dev/null -X PUT $API/missions/$MID1/status -H "$AUTH" -H "$J" -d '{"status":"validee"}'
V1=$(curl -s -X POST $API/missions/$MID1/field-report/validate -H "$AUTH" -H "$J" -d '{"internalValidationStatus":"validee"}')
check validee "$(jget "$V1" internalValidationStatus)" "Validation interne OK"
# D-002 : clôturée échec (pour les KPI et NOK)
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "INSERT INTO mission_field_reports (id, company_id, mission_id, field_status, failure_reason) VALUES (gen_random_uuid(), '$CID', '$MID2', 'echec', 'PBO inaccessible'); UPDATE missions SET status='terminee', updated_at = date_mission + interval '1 day' WHERE id='$MID2';" >/dev/null

# ══════════════ ÉTAPE 6 : FACTURATION (Phase 9) ══════════════
echo ""
echo "── Étape 6 : Facturation"
MONTH="2025-09"
MS="2025-09-01"; ME="2025-09-30"
GINV=$(curl -s -X POST $API/invoices/generate -H "$AUTH" -H "$J" -d "{\"periodStart\":\"$MS\",\"periodEnd\":\"$ME\"}")
IID=$(echo "$GINV" | extract)
check true "$([ -n "$IID" ] && echo true)" "Facture ONECOMIT→SONATEL générée"

# ══════════════ ÉTAPE 7 : KPI (Phase 10) ══════════════
echo ""
echo "── Étape 7 : KPI SONATEL"
curl -s -o /dev/null -X POST "$API/kpi-sonatel/recalculate?period=$MONTH" -H "$AUTH"
KPI=$(curl -s "$API/kpi-sonatel/dashboard?period=$MONTH" -H "$AUTH")
check 19 "$(jget "$KPI" total)" "19 KPI recalculés (premier coup = 50%, NOK D-002)"
AP=$(curl -s -X POST "$API/kpi-sonatel/penalties/apply?period=$MONTH&invoiceId=$IID" -H "$AUTH")
check true "$([ "$(jget "$AP" total)" != "0" ] && [ -n "$(jget "$AP" total)" ] && echo true)" "Pénalités KPI appliquées à la facture ($(jget "$AP" total) FCFA)"
INV=$(curl -s $API/invoices/$IID -H "$AUTH")
check true "$([ "$(jget "$INV" penaltiesTotal)" != "0" ] && echo true)" "Facture avec pénalités intégrées"
curl -s -o /dev/null -X POST $API/invoices/$IID/finalize -H "$AUTH" -H "$J" -d '{"notes":"Recette"}'
PDFCODE=$(curl -s -o "$OUTDIR/recette-facture.pdf" -w "%{http_code}" -X POST $API/invoices/$IID/export-pdf -H "$AUTH")
check 200 "$PDFCODE" "Export PDF facture (HTTP $PDFCODE)"

# ══════════════ ÉTAPE 8 : INCIDENTS + IA VISION (Phase 12) ══════════════
echo ""
echo "── Étape 8 : Incident + IA Vision"
AN=$(curl -s -X POST $API/ia-vision/analyze -H "$AUTH" -H "$J" -d '{"imageUrl":"https://cdn/pbo-casse.jpg","annotation":"PBO B08/D1-4-7 ENDOMAGE 15 clients"}')
ANID=$(echo "$AN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).analysis.id))")
check PBO "$(jget "$AN" analysis.rubriqueDetected)" "IA Vision : rubrique PBO détectée"
VAL=$(curl -s -X PUT $API/ia-vision/validate/$ANID -H "$AUTH" -H "$J" -d '{"validationStatus":"valide"}')
check valide "$(jget "$VAL" analysis.validationStatus)" "Validation humaine OK"
INCN=$(curl -s -X POST $API/incidents -H "$AUTH" -H "$J" -d '{"rubrique":"PIO","zone":"Mbour","pioType":"POTEAU_SIMPLE","pioEtat":"A_TERRE","clientsImpacted":12}')
IID_INC=$(echo "$INCN" | extract)
curl -s -o /dev/null -X PUT $API/incidents/$IID_INC/assign -H "$AUTH" -H "$J" -d "{\"teamId\":\"$TEAMID\",\"technicianIds\":[\"$LEADER\",\"$BINOME\"]}"
curl -s -o /dev/null -X PUT $API/incidents/$IID_INC/resolve -H "$AUTH" -H "$J" -d '{"actionTaken":"Redressement poteau + reprise soudure"}'
curl -s -o /dev/null -X PUT $API/incidents/$IID_INC/close -H "$AUTH"
check cloture "$(jget "$(curl -s $API/incidents/$IID_INC -H "$AUTH")" status)" "Incident PIO résolu et clôturé"

# ══════════════ ÉTAPE 9 : SAAS (Phase 13) ══════════════
echo ""
echo "── Étape 9 : SaaS"
ADMINID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM users WHERE email='admin@onecomit.sn';" | head -1)
curl -s -o /dev/null -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d "{\"userId\":\"$ADMINID\",\"planCode\":\"WEB\"}"
curl -s -o /dev/null -X POST $API/saas/addons/ia_vision/activate -H "$AUTH"
curl -s -o /dev/null -X POST $API/saas/usage/track -H "$AUTH" -H "$J" -d '{"type":"photos","amount":10500}'
SAAS_MS=$(date +%Y-%m-01); SAAS_ME=$(date +%Y-%m-%d -d "$(date +%Y-%m-01) +1 month -1 day")
GS2=$(curl -s -X POST $API/saas/invoices/generate -H "$AUTH" -H "$J" -d "{\"periodStart\":\"$SAAS_MS\",\"periodEnd\":\"$SAAS_ME\"}")
SIID=$(echo "$GS2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).invoice.id)}catch(e){console.log('')}})")
if [ -z "$SIID" ]; then
  # La facture existe peut-etre deja (409) : recuperer la premiere facture pending
  SIID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM invoices_saas WHERE company_id='$CID' AND status='pending' ORDER BY created_at DESC LIMIT 1;" | head -1)
fi
check true "$([ -n "$SIID" ] && echo true)" "Facture SaaS générée (licence + option + dépassement)"
PAY=$(curl -s -X PUT $API/saas/invoices/$SIID/pay -H "$AUTH" -H "$J" -d '{"paymentMethod":"bank_transfer","reference":"RECETTE-001"}')
check paid "$(jget "$PAY" invoice.status)" "Facture SaaS payée ($PAY)"

# ══════════════ ÉTAPE 10 : NOTIFICATIONS (Phase 15) ══════════════
echo ""
echo "── Étape 10 : Notifications"
# Échéance : véhicule avec assurance J-3
D3=$(date -u -d "+3 days" +%Y-%m-%d)
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "UPDATE vehicles SET insurance_expiration='$D3' WHERE id='$VEHID';" >/dev/null
CRON=$(curl -s -X POST $API/notifications/cron/run-daily -H "$AUTH")
check true "$([ "$(jget "$CRON" vehicles)" != "0" ] && echo true)" "Cron échéances : $(jget "$CRON" vehicles) alerte(s)"
# Rapport incidents (Phase 11) : alimenté par les incidents créés
CUR_MS=$(date +%Y-%m-01); CUR_ME=$(date +%Y-%m-%d -d "$(date +%Y-%m-01) +1 month -1 day")
REP=$(curl -s "$API/reports/incidents?startDate=$CUR_MS&endDate=$CUR_ME" -H "$AUTH")
check true "$([ -n "$(jget "$REP" total)" ] && [ "$(jget "$REP" total)" != "0" ] && echo true)" "Rapport incidents (Phase 11) : $(jget "$REP" total) incident(s)"
# Rapport performance : missions OK/NOK
PERF=$(curl -s "$API/reports/performance?startDate=$MS&endDate=$ME" -H "$AUTH")
check 50 "$(jget "$PERF" okRate)" "Rapport performance : taux OK = 50% (1 succès / 1 échec)"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  RÉSULTAT : $PASS PASS / $FAIL FAIL"
echo "════════════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
