#!/usr/bin/env bash
# VECTRACOM Phase 9 - Facturation client (ONECOMIT -> SONATEL) : test e2e
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

# Purge d'eterministe + bordereau requis
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "DELETE FROM invoice_penalties; DELETE FROM invoice_lines; DELETE FROM invoices; DELETE FROM mission_field_reports; DELETE FROM missions;" >/dev/null
cd "C:\Users\USER\green_T_4/VECTRACOM 1.0/backend"
docker exec vectracom-postgres psql -U vectracom -d vectracom -t -A -c "SELECT count(*) FROM price_items WHERE version='2025';" | grep -q "^52$" || npx ts-node scripts/seed-price-items.ts >/dev/null 2>&1
cd - >/dev/null

# ---- Missions de la p'eriode 2026-09 (cl^otur'ees + non cl^otur'ees) ----
mk() { curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d "{\"clientSite\":\"$1\",\"typeTache\":\"$2\",\"dateMission\":\"$3\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))"; }
M1=$(mk "Client A" "INSTALLATION" "2026-09-03")
M2=$(mk "Client B" "INSTALLATION" "2026-09-10")
M3=$(mk "Client C" "INSTALLATION" "2026-09-20")
M4=$(mk "Client D" "SAV" "2026-09-12")
M5=$(mk "Client E" "INSTALLATION" "2026-09-25")          # planifiee -> exclue
M6=$(mk "Mosqu'ee Touba" "OSM" "2026-09-08")
# Fiche chantier OSM valoris'ee : item 41 x1 (45 000)
curl -s -o /dev/null -X POST $API/site-checklists/$M6 -H "$AUTH" -H "$J" -d '{"data":{"olt":"O_TBA"},"priceItems":[{"itemNumber":41,"quantity":1}]}'
# Cl^oture terrain des missions facturables (statut direct en base pour le fixture)
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "UPDATE missions SET status='terminee' WHERE id IN ('$M1','$M2','$M4'); UPDATE missions SET status='validee' WHERE id IN ('$M3','$M6');" >/dev/null

# ============ T1/T2/T3 : g'en'eration + regroupement + bordereau ============
G=$(curl -s -X POST $API/invoices/generate -H "$AUTH" -H "$J" -d '{"periodStart":"2026-09-01","periodEnd":"2026-09-30"}')
IID=$(echo "$G" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
[ -n "$IID" ] && { PASS=$((PASS+1)); echo "PASS  T1 facture g'en'er'ee ($(jget "$G" invoiceNumber))"; } || { FAIL=$((FAIL+1)); echo "FAIL  T1 g'en'eration : $G"; }
check brouillon "$(jget "$G" status)" "T1 statut initial brouillon"
check 409 "$(code -X POST $API/invoices/generate -H "$AUTH" -H "$J" -d '{"periodStart":"2026-09-01","periodEnd":"2026-09-30"}')" "T1 r'eg'en'eration m^eme p'eriode -> 409"
check 400 "$(code -X POST $API/invoices/generate -H "$AUTH" -H "$J" -d '{"periodStart":"2026-02-01","periodEnd":"2026-02-28"}')" "T1 p'eriode sans mission cl^otur'ee -> 400"

# Attendu : INSTALLATION 3x18000=54000 ; SAV 1x9000 ; OSM type 1x45000 + fiche item41 1x45000
# HT = 153000, TVA 18% = 27540, p'enalit'es 0 -> TTC = 180540
PV=$(curl -s $API/invoices/$IID/preview -H "$AUTH")
check 4 "$(jget "$PV" lines.length)" "T2 lignes regroup'ees par type (4)"
LINE_INSTALL=$(echo "$PV" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const l=j.lines.find(x=>x.itemType==='INSTALLATION');console.log(l?l.quantity+'|'+Number(l.unitPrice)+'|'+Number(l.total):'')})")
check "3|18000|54000" "$LINE_INSTALL" "T3 INSTALLATION : 3 x 18 000 = 54 000 (bordereau item 4)"
LINE_SAV=$(echo "$PV" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const l=j.lines.find(x=>x.itemType==='SAV');console.log(l?l.quantity+'|'+Number(l.unitPrice)+'|'+l.category:'')})")
check "1|9000|SAV" "$LINE_SAV" "T3 SAV : 1 x 9 000, cat'egorie SAV"
LINE_OSM=$(echo "$PV" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);const l=j.lines.find(x=>String(x.itemType).startsWith('Item 41'));console.log(l?l.quantity+'|'+Number(l.unitPrice):'')})")
check "1|45000" "$LINE_OSM" "T3 fiche chantier OSM valoris'ee (item 41 x 45 000)"
check 153000 "$(jget "$PV" totals.totalHt)" "T3 total HT = 153 000"
check 27540 "$(jget "$PV" totals.totalTva)" "T3 TVA 18% = 27 540"
check 180540 "$(jget "$PV" totals.totalTtc)" "T3 total TTC = 180 540"
check "SONATEL SA" "$(jget "$PV" client)" "T4 client = SONATEL SA"

# ============ T5/T6 : correction trac'ee ============
SAV_ID=$(echo "$PV" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j.lines.find(x=>x.itemType==='SAV').id)})")
C=$(curl -s -X PUT $API/invoices/$IID/correct -H "$AUTH" -H "$J" -d "{\"lines\":[{\"lineId\":\"$SAV_ID\",\"quantity\":2,\"unitPrice\":8500,\"correctionReason\":\"Deux d'epannages factur'es, tarif n'egoci'e\"}]}")
check en_correction "$(jget "$C" invoice.status)" "T5 correction -> statut en_correction"
C_LINE=$(echo "$C" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const l=JSON.parse(s).lines.find(x=>x.itemType==='SAV');console.log(l.quantity+'|'+Number(l.unitPrice)+'|'+Number(l.total)+'|'+l.isCorrected+'|'+l.originalQuantity+'|'+Number(l.originalUnitPrice))})")
check "2|8500|17000|true|1|9000" "$C_LINE" "T5 ligne corrig'ee (2 x 8 500) avec valeurs d'origine conserv'ees"
check 1 "$(jget "$C" invoice.corrections.length)" "T6 historique : 1 entr'ee de correction"
check quantity "$(jget "$C" invoice.corrections.0.changes.0.field)" "T6 champ quantity trac'e"
check unitPrice "$(jget "$C" invoice.corrections.0.changes.1.field)" "T6 champ unitPrice trac'e"
check "Deux d'epannages factur'es, tarif n'egoci'e" "$(jget "$C" invoice.corrections.0.changes.0.reason)" "T6 motif trac'e"
# Nouveaux totaux : 54000 + 17000 + 45000 + 45000 = 161000 HT
check 161000 "$(jget "$C" totals.totalHt)" "T5 totaux recalcul'es apres correction (161 000 HT)"
check 400 "$(code -X PUT $API/invoices/$IID/correct -H "$AUTH" -H "$J" -d "{\"lines\":[{\"lineId\":\"$SAV_ID\",\"correctionReason\":\"Sans changement\"}]}")" "T5 correction sans cible de valeur -> 400"

# ============ T7 : finalisation ============
F=$(curl -s -X POST $API/invoices/$IID/finalize -H "$AUTH" -H "$J" -d '{"notes":"Facture Septembre 2026 - v'erifi'ee avec le bordereau 3STB"}')
check finalisee "$(jget "$F" status)" "T7 facture finalis'ee"
check true "$([ -n "$(jget "$F" validatedAt)" ] && echo true)" "T7 validatedAt renseign'e"
check 400 "$(code -X POST $API/invoices/$IID/finalize -H "$AUTH" -H "$J")" "T7 re-finalisation -> 400"
check 400 "$(code -X PUT $API/invoices/$IID/correct -H "$AUTH" -H "$J" -d "{\"lines\":[{\"lineId\":\"$SAV_ID\",\"quantity\":5,\"correctionReason\":\"Trop tard\"}]}")" "T7 correction apres finalisation -> 400"

# ============ T8 : export PDF ============
OUTDIR="$(cd "$(dirname "$0")" && pwd)"
curl -s -D "$OUTDIR/fact_headers.txt" -o "$OUTDIR/facture.pdf" -w "" -X POST $API/invoices/$IID/export-pdf -H "$AUTH"
PDFCODE=$(head -1 "$OUTDIR/fact_headers.txt" | tr -d '\r' | awk '{print $2}')
check 200 "$PDFCODE" "T8 export PDF -> 200"
grep -qi "content-type: application/pdf" "$OUTDIR/fact_headers.txt" && { PASS=$((PASS+1)); echo "PASS  T8 content-type application/pdf"; } || { FAIL=$((FAIL+1)); echo "FAIL  T8 content-type"; }
head -c 5 "$OUTDIR/facture.pdf" | grep -q "%PDF" && { PASS=$((PASS+1)); echo "PASS  T8 signature %PDF"; } || { FAIL=$((FAIL+1)); echo "FAIL  T8 signature"; }

# ============ T9 : export Excel (vrai xlsx relisible) ============
curl -s -D "$OUTDIR/fact_x_headers.txt" -o "$OUTDIR/facture.xlsx" -w "" -X POST $API/invoices/$IID/export-excel -H "$AUTH"
XCODE=$(head -1 "$OUTDIR/fact_x_headers.txt" | tr -d '\r' | awk '{print $2}')
check 200 "$XCODE" "T9 export Excel -> 200"
XREAD=$(node "$(dirname "$0")/read-invoice-xlsx.js" "$OUTDIR/facture.xlsx")
check 189980 "$XREAD" "T9 xlsx relisible : TOTAL TTC = 189 980"

# ============ T10 : suppression (brouillon uniquement) ============
check 400 "$(code -X DELETE $API/invoices/$IID -H "$AUTH")" "T10 suppression finalis'ee -> 400"
mk2() { curl -s -X POST $API/missions -H "$AUTH" -H "$J" -d "{\"clientSite\":\"$1\",\"typeTache\":\"SURVEY\",\"dateMission\":\"$2\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))"; }
MB=$(mk2 "Client F" "2026-08-05")
docker exec vectracom-postgres psql -U vectracom -d vectracom -q -c "UPDATE missions SET status='terminee' WHERE id='$MB';" >/dev/null
G2=$(curl -s -X POST $API/invoices/generate -H "$AUTH" -H "$J" -d '{"periodStart":"2026-08-01","periodEnd":"2026-08-31"}')
IID2=$(echo "$G2" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).id))")
check true "$(jget "$(curl -s -X DELETE $API/invoices/$IID2 -H "$AUTH")" deleted)" "T10 brouillon supprimable"
check 200 "$(code $API/invoices -H "$AUTH")" "T10 liste des factures -> 200"

echo "---"
echo "R'ESULTAT : $PASS PASS / $FAIL FAIL"
[ "$FAIL" -eq 0 ]
