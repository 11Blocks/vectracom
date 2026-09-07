#!/usr/bin/env bash
# VECTRACOM Phase 5 — Stock & Bordereau : test de bout en bout
# Prérequis : API sur :3100, tenant ONECOMIT actif.
set -u
API="http://localhost:3100/api/v1"
PASS=0; FAIL=0

check() {
  if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "PASS  $3"; else FAIL=$((FAIL+1)); echo "FAIL  $3 (attendu=$1 obtenu=$2)"; fi
}
jget() { node -e "const d=JSON.parse(process.argv[1]);const p=process.argv[2].split('.');let v=d;for(const k of p){v=v?.[k]}console.log(v===undefined||v===null?'':String(v))" "$1" "$2"; }
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
lvl() { docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT COALESCE(quantity,0) FROM stock_levels WHERE stock_item_id='$1' AND warehouse_id='$2';"; echo -n ""; }

LOGIN=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@onecomit.sn","password":"Onecomit!2026"}')
TT=$(echo "$LOGIN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
[ -n "$TT" ] && { PASS=$((PASS+1)); echo "PASS  login admin ONECOMIT"; } || { FAIL=$((FAIL+1)); echo "FAIL  login"; }
AUTH="Authorization: Bearer $TT"
J="Content-Type: application/json"

# Purge déterministe (les véhicules référencent les warehouses : purge d'abord)
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "DELETE FROM vehicle_checks; DELETE FROM vehicle_documents; DELETE FROM vehicles; DELETE FROM stock_movements; DELETE FROM stock_levels; DELETE FROM item_serials; DELETE FROM item_batches; DELETE FROM stock_items; DELETE FROM warehouses; DELETE FROM price_items;" >/dev/null

# ============ T1 : entrepôts CENTRAL / VEHICLE / SITE ============
W1=$(curl -s -X POST $API/warehouses -H "$AUTH" -H "$J" -d '{"type":"CENTRAL","name":"Dépôt Central Dakar","zone":"Dakar"}')
WID1=$(echo "$W1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
W2=$(curl -s -X POST $API/warehouses -H "$AUTH" -H "$J" -d '{"type":"VEHICLE","name":"Camionnette DK-1234-AB","zone":"Mbour"}')
WID2=$(echo "$W2" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
W3=$(curl -s -X POST $API/warehouses -H "$AUTH" -H "$J" -d '{"type":"SITE","name":"Site Ngaparou","zone":"Mbour"}')
WID3=$(echo "$W3" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
[ -n "$WID1" ] && [ -n "$WID2" ] && [ -n "$WID3" ] && { PASS=$((PASS+1)); echo "PASS  T1 trois emplacements créés (CENTRAL/VEHICLE/SITE)"; } || { FAIL=$((FAIL+1)); echo "FAIL  T1 création emplacements"; }
check 1 "$(jget "$(curl -s "$API/warehouses?type=VEHICLE" -H "$AUTH")" length)" "T1 filtre type=VEHICLE → 1"
check 409 "$(code -X POST $API/warehouses -H "$AUTH" -H "$J" -d '{"type":"CENTRAL","name":"Dépôt Central Dakar"}')" "T1 doublon d'emplacement → 409"

# ============ T2 : article CONSUMABLE ============
S1=$(curl -s -X POST $API/stock-items -H "$AUTH" -H "$J" -d '{"reference":"FO-CAB-24","designation":"Câble FO distribution 24FO","category":"CONSUMABLE","family":"FIBRE","unit":"m","thresholdAlert":100}')
SID1=$(echo "$S1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check CONSUMABLE "$(jget "$S1" category)" "T2 article CONSUMABLE créé"
check 100 "$(jget "$S1" thresholdAlert)" "T2 seuil d'alerte = 100"
check 409 "$(code -X POST $API/stock-items -H "$AUTH" -H "$J" -d '{"reference":"FO-CAB-24","designation":"Doublon test","category":"CONSUMABLE","family":"FIBRE"}')" "T2 doublon de référence → 409"

# ============ T3 : article ASSET + série ============
S2=$(curl -s -X POST $API/stock-items -H "$AUTH" -H "$J" -d '{"reference":"FO-ONT","designation":"ONT/modem fibre","category":"ASSET","family":"FIBRE","unit":"u","thresholdAlert":5}')
SID2=$(echo "$S2" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check ASSET "$(jget "$S2" category)" "T3 article ASSET créé"
SER1=$(curl -s -X POST $API/stock-items/$SID2/serials -H "$AUTH" -H "$J" -d '{"serialNumber":"SN-ONT-0001"}')
SERID1=$(echo "$SER1" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
check disponible "$(jget "$SER1" status)" "T3 série créée (disponible)"
check 409 "$(code -X POST $API/stock-items/$SID2/serials -H "$AUTH" -H "$J" -d '{"serialNumber":"SN-ONT-0001"}')" "T3 unicité (companyId, serialNumber) → 409"
check 400 "$(code -X POST $API/stock-items/$SID1/serials -H "$AUTH" -H "$J" -d '{"serialNumber":"SN-X"}')" "T3 série refusée sur un CONSUMABLE → 400"

# ============ T4 : entrée ============
M1=$(curl -s -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID1\",\"type\":\"entree\",\"quantity\":500,\"toWarehouseId\":\"$WID1\",\"note\":\"Livraison SONATEL lot L-2025-09\"}")
check entree "$(jget "$M1" movement.type)" "T4 mouvement entrée créé"
check 500 "$(lvl $SID1 $WID1)" "T4 niveau dépôt = 500"
check 400 "$(code -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID1\",\"type\":\"entree\",\"quantity\":10}")" "T4 entrée sans destination → 400"

# ============ T5 : transfert ============
M2=$(curl -s -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID1\",\"type\":\"transfert\",\"quantity\":200,\"fromWarehouseId\":\"$WID1\",\"toWarehouseId\":\"$WID2\"}")
check transfert "$(jget "$M2" movement.type)" "T5 transfert créé"
check 300 "$(lvl $SID1 $WID1)" "T5 niveau dépôt = 300"
check 200 "$(lvl $SID1 $WID2)" "T5 niveau camionnette = 200"
check 400 "$(code -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID1\",\"type\":\"transfert\",\"quantity\":9999,\"fromWarehouseId\":\"$WID1\",\"toWarehouseId\":\"$WID2\"}")" "T5 stock insuffisant → 400"

# ============ T6 : consommation (et ajustement/retour) ============
M3=$(curl -s -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID1\",\"type\":\"consommation\",\"quantity\":150,\"fromWarehouseId\":\"$WID2\",\"note\":\"Mission D-001\"}")
check consommation "$(jget "$M3" movement.type)" "T6 consommation créée"
check 50 "$(lvl $SID1 $WID2)" "T6 niveau camionnette = 50"
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID1\",\"type\":\"retour\",\"quantity\":20,\"toWarehouseId\":\"$WID1\"}"
check 320 "$(lvl $SID1 $WID1)" "T6 retour non utilisé → dépôt = 320"
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID1\",\"type\":\"ajustement\",\"quantity\":100,\"toWarehouseId\":\"$WID2\"}"
check 100 "$(lvl $SID1 $WID2)" "T6 ajustement absolu → camionnette = 100"
LST=$(curl -s "$API/stock-movements?type=consommation" -H "$AUTH")
check 1 "$(jget "$LST" length)" "T6 filtre mouvements type=consommation → 1"

# ============ T7 : échange SAV (chaîne ASSET) ============
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID2\",\"type\":\"entree\",\"quantity\":1,\"toWarehouseId\":\"$WID1\",\"itemSerialId\":\"$SERID1\"}"
check disponible "$(jget "$(curl -s $API/stock-items/$SID2/serials -H "$AUTH")" 0.status)" "T7 série entrée au dépôt (disponible, chaîne SONATEL→dépôt)"
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID2\",\"type\":\"transfert\",\"quantity\":1,\"fromWarehouseId\":\"$WID1\",\"toWarehouseId\":\"$WID2\",\"itemSerialId\":\"$SERID1\"}"
curl -s -o /dev/null -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID2\",\"type\":\"consommation\",\"quantity\":1,\"fromWarehouseId\":\"$WID2\",\"itemSerialId\":\"$SERID1\"}"
check en_cours "$(jget "$(curl -s $API/stock-items/$SID2/serials -H "$AUTH")" 0.status)" "T7 série posée chez le client (en_cours, dépôt→équipe)"
M7=$(curl -s -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID2\",\"type\":\"echange_sav\",\"quantity\":1,\"toWarehouseId\":\"$WID1\",\"itemSerialId\":\"$SERID1\",\"note\":\"SAV : ancien ONT récupéré\"}")
check echange_sav "$(jget "$M7" movement.type)" "T7 échange SAV enregistré"
check defectueux "$(jget "$(curl -s $API/stock-items/$SID2/serials -H "$AUTH")" 0.status)" "T7 ancienne série marquée defectueux (récupérée au dépôt)"
check 1 "$(lvl $SID2 $WID1)" "T7 ancienne unité stockée au dépôt (niveau=1)"
TRACE=$(curl -s $API/stock-serials/$SERID1/traceability -H "$AUTH")
check 4 "$(jget "$TRACE" movements.length)" "T7 traçabilité complète : 4 mouvements"
check 400 "$(code -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID2\",\"type\":\"consommation\",\"quantity\":1,\"fromWarehouseId\":\"$WID1\"}")" "T7 ASSET sans série → 400"

# ============ T8 : bordereau 3STB (52 items) ============
cd "C:\Users\USER\green_T_4/VECTRACOM 1.0/backend" && npx ts-node scripts/seed-price-items.ts >/dev/null 2>&1
PI=$(curl -s "$API/price-items?version=2025" -H "$AUTH")
check 52 "$(jget "$PI" length)" "T8 bordereau 2025 → 52 items"
check 990.00 "$(jget "$(curl -s $API/price-items/10 -H "$AUTH")" unitPrice)" "T8 item 10 Conduite enrobée = 990 FCFA/m"
DUP=$(code -X POST $API/price-items -H "$AUTH" -H "$J" -d '{"itemNumber":10,"designation":"Doublon test","unit":"m","unitPrice":1}')
check 409 "$DUP" "T8 doublon (item, version) → 409"
V2=$(curl -s -X POST $API/price-items -H "$AUTH" -H "$J" -d '{"itemNumber":10,"designation":"Conduite enrobée","unit":"m","unitPrice":1100,"version":"2026"}')
check 2026 "$(jget "$V2" version)" "T8 versioning : item 10 version 2026 coexiste"
UP=$(curl -s -X PUT $API/price-items/10 -H "$AUTH" -H "$J" -d '{"unitPrice":1050}')
check 1050.00 "$(jget "$UP" unitPrice)" "T8 mise à jour prix (2025)"

# ============ T9 : recherche full-text ============
R1=$(curl -s "$API/price-items/search?q=conduite" -H "$AUTH")
check 10 "$(jget "$R1" 0.itemNumber)" "T9 recherche « conduite » → item 10"
R2=$(curl -s "$API/price-items/search?q=poteau" -H "$AUTH")
N2=$(jget "$R2" length); [ "$N2" -ge 2 ] && { PASS=$((PASS+1)); echo "PASS  T9 recherche « poteau » → $N2 résultats (plantation+redressement)"; } || { FAIL=$((FAIL+1)); echo "FAIL  T9 recherche poteau ($N2)"; }
R3=$(curl -s "$API/price-items/search?q=soudure" -H "$AUTH")
check 30 "$(jget "$R3" 0.itemNumber)" "T9 recherche « soudure » → item 30"
CATS=$(curl -s $API/price-items/categories -H "$AUTH")
check true "$([ "$(jget "$CATS" length)" -ge 5 ] && echo true)" "T9 catégories distinctes (≥5)"
R4=$(curl -s "$API/price-items/search?q=poteau&version=2026" -H "$AUTH")
check 0 "$(jget "$R4" length)" "T9 recherche bornée à la version 2026 → 0"

# ============ T10 : alerte stock faible ============
# Câble total = 320 + 100 = 420 > seuil 100 → pas d'alerte.
# FO-ONT (seuil 5) est à 0 suite à l'échange SAV → 1 alerte légitime.
LS=$(curl -s $API/stock-items/low-stock -H "$AUTH")
check 1 "$(jget "$LS" length)" "T10 seule FO-ONT (stock nul) est en alerte"
check FO-ONT "$(jget "$LS" 0.reference)" "T10 l'alerte existante porte sur FO-ONT"
S3=$(curl -s -X POST $API/stock-items -H "$AUTH" -H "$J" -d '{"reference":"FO-PBO","designation":"PBO 144 ports","category":"ASSET","family":"FIBRE","unit":"u","thresholdAlert":5}')
SID3=$(echo "$S3" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
# ASSET : entrée par numéros de série (2 unités)
SER_A=$(curl -s -X POST $API/stock-items/$SID3/serials -H "$AUTH" -H "$J" -d '{"serialNumber":"SN-PBO-0001"}' | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
SER_B=$(curl -s -X POST $API/stock-items/$SID3/serials -H "$AUTH" -H "$J" -d '{"serialNumber":"SN-PBO-0002"}' | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
M10=$(curl -s -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID3\",\"type\":\"entree\",\"quantity\":1,\"toWarehouseId\":\"$WID1\",\"itemSerialId\":\"$SER_A\"}")
M10B=$(curl -s -X POST $API/stock-movements -H "$AUTH" -H "$J" -d "{\"stockItemId\":\"$SID3\",\"type\":\"entree\",\"quantity\":1,\"toWarehouseId\":\"$WID1\",\"itemSerialId\":\"$SER_B\"}")
W10=$(echo "$M10B" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.parse(s).lowStockWarnings?.[0]?.stockItemId??'')})")
check "$SID3" "$W10" "T10 warning renvoyé par le mouvement (2 < seuil 5)"
LS2=$(curl -s $API/stock-items/low-stock -H "$AUTH")
check 2 "$(jget "$LS2" length)" "T10 GET low-stock → 2 alertes (FO-ONT + FO-PBO)"
check FO-PBO "$(jget "$LS2" 1.reference)" "T10 FO-PBO en alerte (2 < seuil 5)"

echo "---"
echo "RÉSULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
