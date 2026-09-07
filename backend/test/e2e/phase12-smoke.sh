#!/usr/bin/env bash
# VECTRACOM Phase 12 - Incidents & IA Vision : test e2e
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

# Purge (la table incidents existe - etendue par synchronize au boot)
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
DELETE FROM incident_feedback; DELETE FROM incident_ai_analysis; DELETE FROM incidents;
DELETE FROM compliance_records; DELETE FROM technicians; DELETE FROM teams;" >/dev/null

# ---------- T1 : incident PBO ----------
I1=$(curl -s -X POST $API/incidents -H "$AUTH" -H "$J" -d '{
  "rubrique":"PBO","zone":"Mbour","gpsLatitude":14.48623,"gpsLongitude":-17.07876,
  "pboReference":"B08/D1-4-7","pboDefaut":"DESORGANISE","pboAnnee":2021,"pboPlaque":"PL-12",
  "clientsImpacted":45,"ndList":["339011082","339011083"],
  "annotationOriginale":"PBO B08/D1-4-7 DESORGANISE 45 clients",
  "photos":[{"type":"signalement","url":"https://cdn/pbo-desorganise.jpg"}]}')
IID1=$(echo "$I1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check INC-2026-0001 "$(jget "$I1" incidentNumber)" "T1 incident PBO cree (INC-2026-0001)"
check MAJEUR "$(jget "$I1" severity)" "T1 severite deduite MAJEUR (45 clients)"
check DESORGANISE "$(jget "$I1" pboDefaut)" "T1 defaut PBO enregistre"
check 2 "$(jget "$I1" ndList.length)" "T1 liste ND (2 clients)"

# ---------- T2 : incident PIO ----------
I2=$(curl -s -X POST $API/incidents -H "$AUTH" -H "$J" -d '{
  "rubrique":"PIO","zone":"Saly","pioType":"POTEAU_SIMPLE","pioEtat":"A_TERRE","pioNbCables":2,"pioCableType":"14p",
  "clientsImpacted":12,"annotationOriginale":"Poteau A_TERRE 2 cables 14p"}')
IID2=$(echo "$I2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check INC-2026-0002 "$(jget "$I2" incidentNumber)" "T2 incident PIO cree"
check POTEAU_SIMPLE "$(jget "$I2" pioType)" "T2 type PIO + etat A_TERRE"
check MAJEUR "$(jget "$I2" severity)" "T2 severite MAJEUR (12 clients)"

# ---------- T3 : incident Chambre ----------
I3=$(curl -s -X POST $API/incidents -H "$AUTH" -H "$J" -d '{
  "rubrique":"CHAMBRE","zone":"Thies","chambreType":"L3T","chambreEtat":"INONDEE",
  "clientsImpacted":60,"annotationOriginale":"Chambre L3T INONDEE"}')
IID3=$(echo "$I3" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check INC-2026-0003 "$(jget "$I3" incidentNumber)" "T3 incident Chambre cree"
check CRITICAL "$(jget "$I3" severity)" "T3 severite CRITICAL (60 clients)"

# ---------- T13 : filtres ----------
check 1 "$(jget "$(curl -s "$API/incidents?rubrique=PBO" -H "$AUTH")" length)" "T13 filtre rubrique=PBO -> 1"
check 1 "$(jget "$(curl -s "$API/incidents?severity=CRITICAL" -H "$AUTH")" length)" "T13 filtre severite=CRITICAL -> 1"
check 1 "$(jget "$(curl -s "$API/incidents?zone=Saly" -H "$AUTH")" length)" "T13 filtre zone=Saly -> 1"
check 3 "$(jget "$(curl -s "$API/incidents?status=signalement" -H "$AUTH")" length)" "T13 filtre statut=signalement -> 3"
check 400 "$(code -X POST $API/incidents -H "$AUTH" -H "$J" -d '{"rubrique":"AUTRE","zone":"X"}')" "T13 rubrique inconnue -> 400"

# ---------- T4 : assignation equipe ----------
TEAMID=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD","zone":"Mbour"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
TECHID=$(curl -s -X POST $API/technicians -H "$AUTH" -H "$J" -d "{\"fullName\":\"Ndiaye Moussa\",\"teamId\":\"$TEAMID\",\"isTeamLeader\":true}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
A=$(curl -s -X PUT $API/incidents/$IID1/assign -H "$AUTH" -H "$J" -d "{\"teamId\":\"$TEAMID\",\"technicianIds\":[\"$TECHID\"],\"validationNotes\":\"Equipe Alpha mobilisee\"}")
check en_cours "$(jget "$A" status)" "T4 assignation -> statut en_cours"
check "$TEAMID" "$(jget "$A" assignedTeamId)" "T4 equipe assignee"
check true "$([ -n "$(jget "$A" assignedAt)" ] && echo true)" "T4 assignedAt renseigne"

# ---------- T5 : changement de statut ----------
S=$(curl -s -X PUT $API/incidents/$IID1/status -H "$AUTH" -H "$J" -d '{"status":"en_attente"}')
check en_attente "$(jget "$S" status)" "T5 statut en_attente"
check 400 "$(code -X PUT $API/incidents/$IID1/status -H "$AUTH" -H "$J" -d '{"status":"cloture"}')" "T5 transition interdite en_attente->cloture -> 400"
curl -s -o /dev/null -X PUT $API/incidents/$IID1/status -H "$AUTH" -H "$J" -d '{"status":"en_cours"}'

# ---------- T6 : resolution ----------
R=$(curl -s -X PUT $API/incidents/$IID1/resolve -H "$AUTH" -H "$J" -d '{"actionTaken":"Reorganisation complete du PBO, 12 sertissages refaits","resolutionDetails":{"items_used":[{"itemNumber":29,"quantity":12}],"hours":3}}')
check corrige "$(jget "$R" status)" "T6 resolution -> corrige"
check true "$([ -n "$(jget "$R" resolvedAt)" ] && echo true)" "T6 resolvedAt renseigne"

# ---------- T7 : rapport PDF ----------
curl -s -D "$OUTDIR/inc_headers.txt" -o "$OUTDIR/incident.pdf" -w "" -X POST $API/incidents/$IID1/report -H "$AUTH"
PDFCODE=$(head -1 "$OUTDIR/inc_headers.txt" | tr -d '\r' | awk '{print $2}')
check 200 "$PDFCODE" "T7 rapport PDF -> 200"
head -c 5 "$OUTDIR/incident.pdf" | grep -q "%PDF" && { PASS=$((PASS+1)); echo "PASS  T7 signature %PDF"; } || { FAIL=$((FAIL+1)); echo "FAIL  T7 signature"; }
check true "$([ -n "$(jget "$(curl -s $API/incidents/$IID1 -H "$AUTH")" reportPdfUrl)" ] && echo true)" "T7 reportPdfUrl renseigne"
check 400 "$(code -X POST $API/incidents/$IID2/report -H "$AUTH")" "T7 rapport sur incident non resolu -> 400"

# ---------- T8 : cloture ----------
C=$(curl -s -X PUT $API/incidents/$IID1/close -H "$AUTH")
check cloture "$(jget "$C" status)" "T8 incident cloture"
check 400 "$(code -X PUT $API/incidents/$IID1/close -H "$AUTH")" "T8 re-cloture -> 400"

# ---------- T9 : analyse IA (mock deterministe YOLO+Gemini) ----------
AN=$(curl -s -X POST $API/ia-vision/analyze -H "$AUTH" -H "$J" -d '{
  "imageUrl":"https://cdn/pbo-casse.jpg",
  "annotation":"PBO B12/S2-8-3 SANS_COUVERCLE 15 clients GPS 14.49001, -17.08002"}')
ANID=$(echo "$AN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).analysis.id))")
check INC-2026-0004 "$(jget "$AN" incident.incidentNumber)" "T9 incident cree par l'analyse IA"
check PBO "$(jget "$AN" analysis.rubriqueDetected)" "T9 YOLO+Gemini : rubrique PBO detectee"
check "B12/S2-8-3" "$(jget "$AN" analysis.pboReferenceDetected)" "T9 reference extraite de l'annotation (OCR)"
check SANS_COUVERCLE "$(jget "$AN" analysis.pboDefautDetected)" "T9 defaut SANS_COUVERCLE detecte"
check 92 "$(jget "$AN" analysis.confidenceRubrique)" "T9 confiance YOLO (92%)"
check SAV "$(jget "$AN" analysis.suggestedMissionType)" "T9 mission suggeree SAV (proposition, jamais automatique)"
check MAJEUR "$(jget "$AN" analysis.suggestedSeverity)" "T9 severite suggeree MAJEUR (15 clients)"

# Correlation : meme reference sur un nouvel envoi -> matchedIncidentId
AN2=$(curl -s -X POST $API/ia-vision/analyze -H "$AUTH" -H "$J" -d '{"imageUrl":"https://cdn/pbo-autre.jpg","annotation":"PBO B12/S2-8-3 ENDOMAGE"}')
check true "$([ -n "$(jget "$AN2" analysis.matchedIncidentId)" ] && echo true)" "T9 correlation avec incident ouvert (meme reference)"

# ---------- T10 : validation humaine ----------
V1=$(curl -s -X PUT $API/ia-vision/validate/$ANID -H "$AUTH" -H "$J" -d '{"validationStatus":"valide"}')
check valide "$(jget "$V1" analysis.validationStatus)" "T10 analyse validee"
INC_AFTER=$(curl -s $API/incidents/$(jget "$AN" incident.id) -H "$AUTH")
check "B12/S2-8-3" "$(jget "$INC_AFTER" pboReference)" "T10 proposition appliquee a l'incident (reference)"
check SANS_COUVERCLE "$(jget "$INC_AFTER" pboDefaut)" "T10 proposition appliquee (defaut)"
check 400 "$(code -X PUT $API/ia-vision/validate/$ANID -H "$AUTH" -H "$J" -d '{"validationStatus":"valide"}')" "T10 re-validation -> 400"

# Validation corrigee : l'IA s'est trompee, l'humain corrige -> feedback
AN3=$(curl -s -X POST $API/ia-vision/analyze -H "$AUTH" -H "$J" -d '{"imageUrl":"https://cdn/chambre-bouchee.jpg","annotation":"Chambre L2T BOUCHEE 5 clients"}')
AN3ID=$(echo "$AN3" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).analysis.id))")
check CHAMBRE "$(jget "$AN3" analysis.rubriqueDetected)" "T10 analyse chambre detectee"
V3=$(curl -s -X PUT $API/ia-vision/validate/$AN3ID -H "$AUTH" -H "$J" -d '{"validationStatus":"corrige","corrections":{"rubrique":"PBO","pboDefaut":"CABLE_DESORDRE","zone":"Mbour"},"correctionNotes":"En realite un PBO avec cable en desordre"}')
check corrige "$(jget "$V3" analysis.validationStatus)" "T10 analyse corrigee par l'humain"
check true "$(jget "$V3" analysis.isCorrected)" "T10 flag isCorrected"
INC3=$(curl -s $API/incidents/$(jget "$AN3" incident.id) -H "$AUTH")
check PBO "$(jget "$INC3" rubrique)" "T10 correction appliquee : rubrique PBO"
check Mbour "$(jget "$INC3" zone)" "T10 correction appliquee : zone"
# Rejet
AN4=$(curl -s -X POST $API/ia-vision/analyze -H "$AUTH" -H "$J" -d '{"imageUrl":"https://cdn/objet.jpg"}')
AN4ID=$(echo "$AN4" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).analysis.id))")
V4=$(curl -s -X PUT $API/ia-vision/validate/$AN4ID -H "$AUTH" -H "$J" -d '{"validationStatus":"rejete","correctionNotes":"Photo hors sujet"}')
check rejete "$(jget "$V4" analysis.validationStatus)" "T10 analyse rejetee"

# ---------- T11 : feedbacks (Active Learning) ----------
FB=$(curl -s "$API/ia-vision/feedback?processed=false" -H "$AUTH")
check 3 "$(jget "$FB" length)" "T11 3 feedbacks collectes (valide+corrige+rejete)"
FB_CORR=$(echo "$FB" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const f=JSON.parse(s).find(x=>x.humanValidation===false&&x.humanCorrectionRubrique);console.log(f?f.humanCorrectionRubrique+'|'+f.humanCorrectionDefaut:'ABSENT')})")
check "PBO|CABLE_DESORDRE" "$FB_CORR" "T11 correction humaine tracee dans le feedback"

# ---------- T12 : traitement par batch ----------
PB=$(curl -s -X POST $API/ia-vision/feedback/process -H "$AUTH")
check 3 "$(jget "$PB" processed)" "T12 batch : 3 feedbacks integres au jeu d'entrainement"
check 1 "$(jget "$PB" validations)" "T12 1 validation conforme"
check 2 "$(jget "$PB" corrections)" "T12 2 corrections/rejets"
check 0 "$(jget "$(curl -s "$API/ia-vision/feedback?processed=false" -H "$AUTH")" length)" "T12 plus aucun feedback non traite"
RT=$(curl -s -X POST $API/ia-vision/retrain -H "$AUTH")
check true "$(jget "$RT" triggered)" "T12/T9 reentrainement declenche (simule en dev)"
check 3 "$(jget "$RT" dataset.total)" "T12 dataset du reentrainement = 3 exemples"

echo "---"
echo "RESULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
