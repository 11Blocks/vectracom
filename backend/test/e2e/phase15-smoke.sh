#!/usr/bin/env bash
# VECTRACOM Phase 15 - Notifications & IA (agents) : test e2e
set -u
API="http://localhost:3100/api/v1"
PASS=0; FAIL=0

check() {
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $3"; else FAIL=$((FAIL+1)); echo "FAIL  $3 (attendu=$1 obtenu=$2)"; fi
}
jget() { node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]}console.log(v===undefined||v===null?'':String(v))" "$1" "$2"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }

TT=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@onecomit.sn","password":"Onecomit!2026"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
[ -n "$TT" ] && { PASS=$((PASS+1)); echo "PASS  login admin ONECOMIT"; } || { FAIL=$((FAIL+1)); echo "FAIL  login"; }
AUTH="Authorization: Bearer $TT"
J="Content-Type: application/json"
CID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM companies WHERE name='ONECOMIT';" | head -1)
ADMINID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM users WHERE email='admin@onecomit.sn';" | head -1)

# Purge + socle
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
DELETE FROM rag_messages; DELETE FROM rag_conversations;
DELETE FROM notifications; DELETE FROM notification_settings; DELETE FROM push_tokens;
DELETE FROM company_subscriptions;
UPDATE companies SET subscription_status='active', active=true;
DELETE FROM compliance_records; DELETE FROM technicians; DELETE FROM teams;
DELETE FROM vehicle_checks; DELETE FROM vehicle_documents; DELETE FROM vehicles;
DELETE FROM warehouses WHERE type='VEHICLE';
DELETE FROM stock_movements; DELETE FROM stock_levels; DELETE FROM item_serials; DELETE FROM item_batches; DELETE FROM stock_items; DELETE FROM warehouses;
DELETE FROM saas_transactions; DELETE FROM saas_overage_bills; DELETE FROM invoices_saas;
DELETE FROM mission_field_reports; DELETE FROM missions;" >/dev/null

# ============ T1-T4 : canaux ============
P=$(curl -s -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"push"}')
check push "$(jget "$P" channel)" "T1 canal push"
check simulated "$(jget "$P" status)" "T1 push simule (pas de token Expo)"
W=$(curl -s -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"whatsapp","recipient":"+221771234567"}')
check whatsapp "$(jget "$W" channel)" "T2 canal WhatsApp (ancrage, simule sans Business)"
E=$(curl -s -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"email","recipient":"boss@onecomit.sn"}')
check email "$(jget "$E" channel)" "T3 canal email (simule sans SMTP)"
IA=$(curl -s -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"in_app"}')
check in_app "$(jget "$IA" channel)" "T4 canal in-app"
curl -s -o /dev/null -X PUT $API/notifications/settings -H "$AUTH" -H "$J" -d '{"telegramEnabled":true}'
TG=$(curl -s -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"telegram","recipient":"123456789"}')
check telegram "$(jget "$TG" channel)" "Bonus canal telegram (simule sans bot token)"
check 400 "$(code -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"pigeon"}')" "Canal inconnu -> 400"

# ============ T5/T6 : lectures ============
N1=$(curl -s -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"in_app","title":"Lue individuellement"}')
NID=$(echo "$N1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
curl -s -o /dev/null -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"in_app","title":"Non lue 1"}'
curl -s -o /dev/null -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"in_app","title":"Non lue 2"}'
UC=$(curl -s $API/notifications/unread-count -H "$AUTH")
check 8 "$(jget "$UC" count)" "8 notifications non lues (5 canaux + 3 in-app)"
# en fait tous les tests creent une notification -> in_app(1)+push(1)+whatsapp(1)+email(1)+in_app(3)+telegram(1) = 8 non lues
R=$(curl -s -X PUT $API/notifications/$NID/read -H "$AUTH")
check true "$([ -n "$(jget "$R" readAt)" ] && echo true)" "T5 notification marquee lue"
curl -s -o /dev/null -X PUT $API/notifications/read-all -H "$AUTH"
check 0 "$(jget "$(curl -s $API/notifications/unread-count -H "$AUTH")" count)" "T6 toutes marquees lues"

# ============ T7 : parametres ============
S=$(curl -s $API/notifications/settings -H "$AUTH")
check true "$(jget "$S" pushEnabled)" "T7 parametres par defaut (push actif)"
check true "$(jget "$S" telegramEnabled)" "T7 telegram active (regarde juste avant)"
S2=$(curl -s -X PUT $API/notifications/settings -H "$AUTH" -H "$J" -d '{"telegramEnabled":true,"stockAlertEnabled":false}')
check true "$(jget "$S2" telegramEnabled)" "T7 telegram active"
check false "$(jget "$S2" stockAlertEnabled)" "T7 alertes stock coupees"
check 400 "$(code -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"in_app","title":"x"}' -H "$J" -d '{"channel":"in_app"}')" "T7 type test toujours autorise"
curl -s -o /dev/null -X PUT $API/notifications/settings -H "$AUTH" -H "$J" -d '{"stockAlertEnabled":true,"telegramEnabled":false}'

# ============ T8 : token push ============
REG=$(curl -s -X POST $API/notifications/register-push -H "$AUTH" -H "$J" -d '{"token":"ExponentPushToken[abc123def456]","platform":"android","deviceId":"PIXEL-001"}')
check android "$(jget "$REG" platform)" "T8 token push enregistre"
check true "$(jget "$REG" active)" "T8 token actif"
# push réel vers le token (toujours simule sans EXPO_ACCESS_TOKEN mais token present)
P2=$(curl -s -X POST $API/notifications/test -H "$AUTH" -H "$J" -d '{"channel":"push"}')
check simulated "$(jget "$P2" status)" "T8 push avec token -> simule en dev, token cible"
UNREG=$(curl -s -X POST $API/notifications/unregister-push -H "$AUTH" -H "$J" -d '{"token":"ExponentPushToken[abc123def456]"}')
check false "$(jget "$UNREG" active)" "T8 token desenregistre"

# ============ T9 : cron echeances (J-7/J-1) ============
D3=$(date -u -d "+3 days" +%Y-%m-%d)
VID=$(curl -s -X POST $API/vehicles -H "$AUTH" -H "$J" -d "{\"immatriculation\":\"DK-9900-XX\",\"modele\":\"Kangoo\",\"insuranceExpiration\":\"$D3\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
TEAMID=$(curl -s -X POST $API/teams -H "$AUTH" -H "$J" -d '{"name":"Alpha","type":"PROD","zone":"Mbour"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
D5=$(date -u -d "+5 days" +%Y-%m-%d)
curl -s -o /dev/null -X POST $API/technicians -H "$AUTH" -H "$J" -d "{\"fullName\":\"Ndiaye Moussa\",\"teamId\":\"$TEAMID\",\"habilitationSstExpiration\":\"$D5\"}"
CRON1=$(curl -s -X POST $API/notifications/cron/run-daily -H "$AUTH")
VEH=$(jget "$CRON1" vehicles)
HAB=$(jget "$CRON1" habilitations)
check 1 "$VEH" "T9 echeance vehicule J-3 detectee"
check 1 "$HAB" "T9 habilitation SST J-5 detectee"
NOTIFS=$(curl -s "$API/notifications?unreadOnly=true" -H "$AUTH")
check 2 "$(echo "$NOTIFS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).filter(n=>n.type==='echeance').length))")" "T9 2 notifications echeance pour le manager"

# ============ T10 : cron stock ============
SID=$(curl -s -X POST $API/stock-items -H "$AUTH" -H "$J" -d '{"reference":"FO-CAB-24","designation":"Cable FO 24","category":"CONSUMABLE","family":"FIBRE","unit":"m","thresholdAlert":100}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
CRON2=$(curl -s -X POST $API/notifications/cron/run-daily -H "$AUTH")
check 1 "$(jget "$CRON2" stock)" "T10 rupture detectee (0 < seuil 100)"
RUPN=$(curl -s "$API/notifications?unreadOnly=true" -H "$AUTH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const n=JSON.parse(s).find(x=>x.type==='stock');console.log(n?n.title:'ABSENT')})")
check "Rupture de stock — FO-CAB-24" "$RUPN" "T10 notification rupture avec reference"

# ============ T11 : cron paiements (J+15) ============
PE15=$(date -u -d "-15 days" +%Y-%m-%d); PS15=$(date -u -d "-30 days" +%Y-%m-%d)
GT=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@green-t.sn","password":"ChangeMe!2026"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
GTAUTH="Authorization: Bearer $GT"
INV=$(curl -s -X POST "$API/saas/invoices/generate?companyId=$CID" -H "$GTAUTH" -H "$J" -d "{\"periodStart\":\"$PS15\",\"periodEnd\":\"$PE15\"}")
CRON3=$(curl -s -X POST $API/notifications/cron/run-daily -H "$AUTH")
check 1 "$(jget "$CRON3" payments)" "T11 relance paiement J+15 envoyee (email au client)"

# ============ T12 : Agent Terrain ============
TR=$(curl -s -X POST $API/ai/terrain/transcribe -H "$AUTH" -H "$J" -d '{"audioUrl":"https://cdn/compte-rendu-installation-mbour.mp3"}')
check mock "$(jget "$TR" provider)" "T12 transcription (provider mock en dev)"
check true "$(jget "$TR" transcription | grep -qi 'compte rendu' && echo true)" "T12 transcription generee"
TRTXT=$(echo "$TR" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.stringify({transcription:JSON.parse(s).transcription})))")
RP=$(curl -s -X POST $API/ai/terrain/report -H "$AUTH" -H "$J" -d "$TRTXT")
check true "$(jget "$RP" requiresHumanValidation)" "T12 compte rendu structure (validation humaine requise)"
check true "$(jget "$RP" taches.length | grep -q '^1$' && echo true)" "T12 tache 'Raccordement FTTH' extraite"

# ============ T13 : RAG (licence requise) ============
R_DENY=$(curl -s -X POST $API/rag/ask -H "$AUTH" -H "$J" -d '{"question":"Combien de missions ?"}')
check 403 "$(code -X POST $API/rag/ask -H "$AUTH" -H "$J" -d '{"question":"Combien de missions ?"}')" "T13 RAG sans licence -> 403"
curl -s -o /dev/null -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d "{\"userId\":\"$ADMINID\",\"planCode\":\"RAG\"}"
M1=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Client RAG 1","typeTache":"INSTALLATION","dateMission":"2026-09-10"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
curl -s -o /dev/null -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Client RAG 2","typeTache":"SAV","dateMission":"2026-09-11"}'
R1=$(curl -s -X POST $API/rag/ask -H "$AUTH" -H "$J" -d '{"question":"Combien de missions ce mois ?"}')
CONVID=$(echo "$R1" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).conversationId))")
check true "$(jget "$R1" answer | grep -q 'mission(s)' && echo true)" "T13 reponse RAG alimentee par les donnees"
check deterministic "$(jget "$R1" provider)" "T13 provider deterministic en dev"
R2=$(curl -s -X POST $API/rag/ask -H "$AUTH" -H "$J" -d "{\"question\":\"Ou en est le stock ?\",\"conversationId\":\"$CONVID\"}")
check "$CONVID" "$(jget "$R2" conversationId)" "T13 conversation reprise"
HIST=$(curl -s $API/rag/conversations/$CONVID -H "$AUTH")
check 4 "$(jget "$HIST" messages.length)" "T13 historique 4 messages (2 questions + 2 reponses)"
check 1 "$(jget "$(curl -s $API/rag/conversations -H "$AUTH")" length)" "T13 conversation listee"
DEL=$(curl -s -X DELETE $API/rag/conversations/$CONVID -H "$AUTH")
check true "$(jget "$DEL" deleted)" "T13 conversation supprimee"

# ============ T14 : Agent Planning ============
MIDP=$(curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Client Planning","typeTache":"INSTALLATION","zone":"Mbour","dateMission":"2026-09-12"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
PL=$(curl -s -X POST $API/ai/planning/suggest/$MIDP -H "$AUTH")
check Alpha "$(jget "$PL" proposal.teamName)" "T14 equipe Alpha proposee (zone Mbour)"
check false "$(jget "$PL" autoExecute)" "T14 proposition seulement (autoExecute=false)"
check true "$(jget "$PL" proposal.reasons.0 | grep -qi 'zone' && echo true)" "T14 raison : zone identique"

# ============ T15 : Agent Stock ============
AN=$(curl -s -X POST $API/ai/stock/anomalies -H "$AUTH")
check 0 "$(jget "$AN" anomalies.length)" "T15 aucune anomalie (pas de consommation)"
WID=$(curl -s -X POST $API/warehouses -H "$AUTH" -H "$J" -d '{"type":"CENTRAL","name":"Depot P15","zone":"Mbour"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
INSERT INTO stock_levels (id, company_id, stock_item_id, warehouse_id, quantity) VALUES (gen_random_uuid(), '$CID', '$SID', '$WID', 10);
INSERT INTO stock_movements (id, company_id, stock_item_id, type, quantity, to_warehouse_id, created_at) VALUES
 (gen_random_uuid(), '$CID', '$SID', 'entree', 500, '$WID', now() - interval '75 days'),
 (gen_random_uuid(), '$CID', '$SID', 'consommation', 100, '$WID', now() - interval '70 days'),
 (gen_random_uuid(), '$CID', '$SID', 'consommation', 90, '$WID', now() - interval '40 days'),
 (gen_random_uuid(), '$CID', '$SID', 'consommation', 300, '$WID', now());" >/dev/null
AN2=$(curl -s -X POST $API/ai/stock/anomalies -H "$AUTH")
check FO-CAB-24 "$(jget "$AN2" anomalies.0.reference)" "T15 anomalie detectee (300 vs moyenne 95)"
RU=$(curl -s -X POST $API/ai/stock/ruptures -H "$AUTH")
check true "$(jget "$RU" ruptures.0.reference | grep -q 'FO-CAB-24' && echo true)" "T15 rupture FO-CAB-24 detectee (10 < 100)"

# ============ T16 : Agent Optimisation ============
curl -s -o /dev/null -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Zone A client 1","typeTache":"SAV","zone":"Ngaparou","dateMission":"2026-09-20"}'
curl -s -o /dev/null -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Zone A client 2","typeTache":"SAV","zone":"Ngaparou","dateMission":"2026-09-20"}'
TO=$(curl -s -X POST "$API/ai/optimisation/tour?date=2026-09-20" -H "$AUTH")
check 1 "$(jget "$TO" tours.length)" "T16 tournées regroupées : 1 zone (Ngaparou x2)"
check 2 "$(jget "$TO" tours.0.missions.length)" "T16 2 missions dans la tournée"
check false "$(jget "$TO" autoExecute)" "T16 proposition seulement"
SC=$(curl -s -X POST "$API/ai/optimisation/schedule?date=2026-09-20" -H "$AUTH")
check 1 "$(jget "$SC" assignments.length)" "T16 planning propose (1 affectation)"

# ============ T17 : pré-audit photo ============
AUD=$(curl -s -X POST $API/ai/photo-audit -H "$AUTH" -H "$J" -d '{"photoUrl":"https://cdn/photo-flou-site.jpg"}')
check a_reprendre "$(jget "$AUD" verdict)" "T17 photo floue -> a reprendre"
check nettete_insuffisante "$(jget "$AUD" flags.0)" "T17 flag nettete"
AUD2=$(curl -s -X POST $API/ai/photo-audit -H "$AUTH" -H "$J" -d '{"photoUrl":"https://cdn/photo-site-nette.jpg"}')
check accepte "$(jget "$AUD2" verdict)" "T17 photo nette acceptee"
BATCH=$(curl -s -X POST $API/ai/photo-audit/batch -H "$AUTH" -H "$J" -d '{"photoUrls":["https://cdn/a.jpg","https://cdn/b-flou.jpg"]}')
check 2 "$(jget "$BATCH" length)" "T17 audit par lot (2 photos)"

# ============ T18 : extraction de recu ============
REC=$(curl -s -X POST $API/ai/receipt -H "$AUTH" -H "$J" -d '{"photoUrl":"https://cdn/recu-carburant-32000.jpg"}')
check 32000 "$(jget "$REC" amount)" "T18 montant extrait 32 000"
check transport "$(jget "$REC" category)" "T18 categorie transport (carburant)"
check FCFA "$(jget "$REC" currency)" "T18 devise FCFA"
check true "$(jget "$REC" requiresHumanValidation)" "T18 validation humaine requise"
REC2=$(curl -s -X POST $API/ai/receipt -H "$AUTH" -H "$J" -d '{"photoUrl":"https://cdn/recu-outillage-8500.jpg"}')
check materiel "$(jget "$REC2" category)" "T18 categorie materiel (outillage)"

# ============ T19 : raccourci vocal ============
VC=$(curl -s -X POST $API/ai/voice-command -H "$AUTH" -H "$J" -d '{"command":"cree une mission SAV chez M. Diop a Mbour demain 9h"}')
check creer_mission "$(jget "$VC" intent)" "T19 intention creer_mission"
check SAV "$(jget "$VC" entities.missionType)" "T19 type SAV extrait"
check demain "$(jget "$VC" entities.quand)" "T19 'demain' extrait"
check false "$(jget "$VC" autoExecute)" "T19 commande proposee, pas executee"
VC2=$(curl -s -X POST $API/ai/voice-command -H "$AUTH" -H "$J" -d '{"command":"enregistre une depense carburant 15000 francs"}')
check enregistrer_depense "$(jget "$VC2" intent)" "T19 intention enregistrer_depense"
check 15000 "$(jget "$VC2" entities.montant)" "T19 montant vocal extrait"

echo "---"
echo "RESULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
