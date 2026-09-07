#!/usr/bin/env bash
# VECTRACOM Phase 13 - SaaS (abonnements, limites, facturation) : test e2e
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

# Purge SaaS + remise du tenant en actif + un second utilisateur pour les licences
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "
UPDATE companies SET subscription_status='active', active=true WHERE name='ONECOMIT';
DELETE FROM saas_transactions; DELETE FROM saas_overage_bills; DELETE FROM invoices_saas;
DELETE FROM company_subscriptions; DELETE FROM saas_usage_tracking; DELETE FROM saas_limits; DELETE FROM saas_addons;
DELETE FROM users WHERE email='chef@onecomit.sn';" >/dev/null
CID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM companies WHERE name='ONECOMIT';")
ADMINID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT id FROM users WHERE email='admin@onecomit.sn';")
CHEFID=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "INSERT INTO users (id, company_id, email, password_hash, full_name, role, active, license_type, license_active) VALUES (gen_random_uuid(), '$CID', 'chef@onecomit.sn', '\$2a\$10\$placeholderhashplaceholderhashplacehol', 'Chef Alpha', 'chef_equipe', true, NULL, true) RETURNING id;" | tr -d ' ' | head -1)

# ============ T1 : plans tarifaires ============
PLANS=$(curl -s $API/saas/plans -H "$AUTH")
check 4 "$(jget "$PLANS" length)" "T1 4 plans au catalogue"
PM=$(echo "$PLANS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const p=JSON.parse(s);const m={};p.forEach(x=>m[x.code]=Number(x.priceMonthly));console.log(m.MOBILE+'|'+m.WEB+'|'+m.RAG+'|'+m.GEOLOCATION)})")
check "10000|25000|15000|5000" "$PM" "T1 prix : MOBILE 10 000 / WEB 25 000 / RAG 15 000 / GEOLOC 5 000"

# ============ T2 : activation option IA Vision PBO ============
ACT=$(curl -s -X POST $API/saas/addons/ia_vision/activate -H "$AUTH")
check ia_vision "$(jget "$ACT" addonType)" "T2 option ia_vision activee"
check true "$(jget "$ACT" isActive)" "T2 isActive"
check 50000 "$(jget "$ACT" priceMonthly)" "T2 prix 50 000 FCFA/mois"
check true "$([ -n "$(jget "$ACT" trialEndsAt)" ] && echo true)" "T2 periode d'essai 7 jours"
check 400 "$(code -X POST $API/saas/addons/option_inconnue/activate -H "$AUTH")" "T2 option inconnue -> 400"

# ============ T3 : desactivation ============
DEACT=$(curl -s -X POST $API/saas/addons/ia_vision/deactivate -H "$AUTH")
check false "$(jget "$DEACT" isActive)" "T3 option desactivee"
check 404 "$(code -X POST $API/saas/addons/pre_audit/deactivate -H "$AUTH")" "T3 desactivation d'une option jamais active -> 404"
curl -s -o /dev/null -X POST $API/saas/addons/ia_vision/activate -H "$AUTH" # reactivee pour la facturation

# ============ T4 : licences ============
LIC1=$(curl -s -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d "{\"userId\":\"$ADMINID\",\"planCode\":\"WEB\"}")
check WEB "$(jget "$LIC1" planCode)" "T4 licence WEB attribuee a l'admin"
check 25000.00 "$(jget "$LIC1" amount)" "T4 montant 25 000 FCFA"
LIC2=$(curl -s -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d "{\"userId\":\"$CHEFID\",\"planCode\":\"MOBILE\"}")
check MOBILE "$(jget "$LIC2" planCode)" "T4 licence MOBILE attribuee au chef"
CHEF_LIC=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT license_type FROM users WHERE id='$CHEFID';")
check mobile "$CHEF_LIC" "T4 user.licenseType mis a jour (mobile)"
check 2 "$(jget "$(curl -s $API/saas/licenses -H "$AUTH")" length)" "T4 le tenant a 2 licences"
# Reattribution : l'ancienne est annulee
curl -s -o /dev/null -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d "{\"userId\":\"$CHEFID\",\"planCode\":\"RAG\"}"
check 3 "$(jget "$(curl -s $API/saas/licenses -H "$AUTH")" length)" "T4 reattribution : historique conserve (3 lignes)"
check 2 "$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM company_subscriptions WHERE status='active';")" "T4 2 licences actives apres reattribution"

# ============ T5 : revocation ============
REV=$(curl -s -X POST $API/saas/licenses/revoke -H "$AUTH" -H "$J" -d "{\"userId\":\"$CHEFID\"}")
check true "$(jget "$REV" revoked)" "T5 licence du chef revoquee"
CHEF_LIC2=$(docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT license_type FROM users WHERE id='$CHEFID';")
check "" "$CHEF_LIC2" "T5 user.licenseType efface"
curl -s -o /dev/null -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d "{\"userId\":\"$CHEFID\",\"planCode\":\"MOBILE\"}" # remise pour facturation
check 400 "$(code -X POST $API/saas/licenses/assign -H "$AUTH" -H "$J" -d '{"userId":"00000000-0000-0000-0000-000000000000","planCode":"WEB"}')" "T5 utilisateur inconnu -> 400"

# ============ T6 : suivi d'usage ============
MONTH=$(date +%Y-%m)
curl -s -o /dev/null -X POST $API/saas/usage/track -H "$AUTH" -H "$J" -d '{"type":"photos","amount":10500}'
curl -s -o /dev/null -X POST $API/saas/usage/track -H "$AUTH" -H "$J" -d '{"type":"ia","amount":120}'
curl -s -o /dev/null -X POST $API/saas/usage/track -H "$AUTH" -H "$J" -d '{"type":"api","amount":600}'
TR=$(curl -s -X POST $API/saas/usage/track -H "$AUTH" -H "$J" -d '{"type":"storage_mb","amount":15360}')
check true "$(jget "$TR" overLimit)" "T6 stockage 15 GB > seuil 10 GB -> overLimit"
USAGE=$(curl -s "$API/saas/usage?month=$MONTH" -H "$AUTH")
check 10500 "$(jget "$USAGE" photosCount)" "T6 photos comptees (10 500)"
check 120 "$(jget "$USAGE" iaRequests)" "T6 requetes IA comptees (120)"
check 600 "$(jget "$USAGE" apiRequests)" "T6 requetes API comptees (600)"
check 15360 "$(jget "$USAGE" storageUsedMb)" "T6 stockage compte (15 360 Mo)"
LIM=$(curl -s $API/saas/limits -H "$AUTH")
check 10000 "$(jget "$LIM" maxPhotosPerMonth)" "T6 limites base par defaut (10 000 photos)"

# ============ T7 : depassements ============
OV=$(curl -s "$API/saas/overage?month=$MONTH" -H "$AUTH")
# photos 500 excedent -> 1 bloc x 5000 ; ia 20 x 500 ; storage 5GB -> 1 bloc x 10000 ; api 100 -> 1 bloc x 1000
check 4 "$(jget "$OV" bills.length)" "T7 4 lignes de depassement"
check 26000 "$(jget "$OV" total)" "T7 total depassements 26 000 FCFA"
OVP=$(echo "$OV" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s).bills.find(x=>x.type==='photos');console.log(b.quantity+'|'+Number(b.unitPrice)+'|'+Number(b.total))})")
check "1|5000|5000" "$OVP" "T7 photos : 1 bloc x 5 000"
OVI=$(echo "$OV" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const b=JSON.parse(s).bills.find(x=>x.type==='ia');console.log(b.quantity+'|'+Number(b.total))})")
check "20|10000" "$OVI" "T7 IA : 20 requetes x 500 = 10 000"

# ============ T8 : facture SaaS (mois courant : inclut les depassements) ============
GEN=$(curl -s -X POST $API/saas/invoices/generate -H "$AUTH" -H "$J" -d '{"periodStart":"2026-09-01","periodEnd":"2026-09-30"}')
IID=$(echo "$GEN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).invoice.id))")
check SAAS-202609-001 "$(jget "$GEN" invoice.invoiceNumber)" "T8 facture SAAS-202609-001 generee"
# HT = WEB 25000 + MOBILE 10000 + option ia_vision 50000 + overage 26000 = 111000 ; TVA 18% = 19980 ; TTC = 130980
check 111000.00 "$(jget "$GEN" invoice.totalHt)" "T8 HT = 111 000 (2 licences + option + depassements)"
check 19980.00 "$(jget "$GEN" invoice.totalTva)" "T8 TVA 18% = 19 980"
check 130980.00 "$(jget "$GEN" invoice.totalTtc)" "T8 TTC = 130 980"
check 7 "$(jget "$GEN" transactions.length)" "T8 7 transactions (2 licences + option + 4 depassements)"
check 4 "$(jget "$GEN" overage.length)" "T8 depassements rattaches a la facture"
check 409 "$(code -X POST $API/saas/invoices/generate -H "$AUTH" -H "$J" -d '{"periodStart":"2026-09-01","periodEnd":"2026-09-30"}')" "T8 regeneration meme periode -> 409"

# ============ T9 : paiement ============
PAY=$(curl -s -X PUT $API/saas/invoices/$IID/pay -H "$AUTH" -H "$J" -d '{"paymentMethod":"mobile_money","reference":"WAVE-2026-0001"}')
check paid "$(jget "$PAY" invoice.status)" "T9 facture payee"
check mobile_money "$(jget "$PAY" invoice.paymentMethod)" "T9 moyen de paiement mobile_money"
check WAVE-2026-0001 "$(jget "$PAY" invoice.reference)" "T9 reference de paiement"
check 400 "$(code -X PUT $API/saas/invoices/$IID/pay -H "$AUTH" -H "$J" -d '{"paymentMethod":"card"}')" "T9 double paiement -> 400"

# ============ T10/T11/T12 : impayes + relances + blocage progressif ============
# Facture J+20 : periode se terminant il y a exactement 20 jours (relatif au jour courant)
PE20=$(date -u -d "-21 days" +%Y-%m-%d); PS20=$(date -u -d "-34 days" +%Y-%m-%d)
GEN20=$(curl -s -X POST $API/saas/invoices/generate -H "$AUTH" -H "$J" -d "{\"periodStart\":\"$PS20\",\"periodEnd\":\"$PE20\"}")
IID20=$(echo "$GEN20" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).invoice.id))")
OD20=$(curl -s -X PUT $API/saas/invoices/$IID20/overdue -H "$AUTH")
check overdue "$(jget "$OD20" invoice.status)" "T10 facture marquee impayee"
check 20 "$(jget "$OD20" daysLate)" "T11 retard calcule : 20 jours"
check retard_j20 "$(jget "$OD20" companyStatus)" "T11 relance J+20 -> retard_j20"
# Blocage lecture seule : GET passe, ecriture refusee
check 200 "$(code $API/auth/me -H "$AUTH")" "T12 J+20 : lecture autorisee"
check 403 "$(code -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"X","typeTache":"SAV","dateMission":"2026-09-15"}')" "T12 J+20 : ecriture bloquee"
# Facture J+30 -> suspendu : tout bloque
# Le tenant est en retard_j20 (lecture seule) : la facture J+30 est generee par la console Green-T
GT=$(curl -s -X POST $API/auth/login -H "Content-Type: application/json" -d '{"email":"admin@green-t.sn","password":"ChangeMe!2026"}' | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).accessToken))")
GTAUTH="Authorization: Bearer $GT"
PE30=$(date -u -d "-31 days" +%Y-%m-%d); PS30=$(date -u -d "-44 days" +%Y-%m-%d)
GEN30=$(curl -s -X POST "$API/saas/invoices/generate?companyId=$CID" -H "$GTAUTH" -H "$J" -d "{\"periodStart\":\"$PS30\",\"periodEnd\":\"$PE30\"}")
IID30=$(echo "$GEN30" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).invoice.id))")
OD30=$(curl -s -X PUT "$API/saas/invoices/$IID30/overdue?companyId=$CID" -H "$GTAUTH")
check 30 "$(jget "$OD30" daysLate)" "T11 retard calcule : 30 jours"
check suspendu "$(jget "$OD30" companyStatus)" "T11 relance J+30 -> suspendu"
check 403 "$(code $API/auth/me -H "$AUTH")" "T12 J+30 : acces totalement bloque"
# Paiement -> reactivation complete
PAY30=$(curl -s -X PUT "$API/saas/invoices/$IID30/pay?companyId=$CID" -H "$GTAUTH" -H "$J" -d '{"paymentMethod":"bank_transfer","reference":"VIR-2026-0042"}')
check paid "$(jget "$PAY30" invoice.status)" "T9/T12 facture J+30 payee"
check 200 "$(code $API/auth/me -H "$AUTH")" "T12 paiement -> tenant reactive (acces complet)"
check 201 "$(code -X POST $API/missions -H "$AUTH" -H "$J" -d '{"clientSite":"Apres paiement","typeTache":"SAV","dateMission":"2026-09-15"}')" "T12 ecriture retablie (201)"

echo "---"
echo "RESULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
