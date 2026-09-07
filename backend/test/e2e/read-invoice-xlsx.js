/** Lit la facture exportée et imprime le TOTAL TTC (usage : node read-invoice-xlsx.js <file.xlsx>) */
const path = require('path');
// Les dépendances sont hoistées au node_modules racine (npm workspaces).
const XLSX = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'xlsx'));
const file = process.argv[2];
const wb = XLSX.readFile(file);
const rows = XLSX.utils.sheet_to_json(wb.Sheets.Facture);
const ttc = rows.find((r) => r.Item === 'TOTAL TTC');
console.log(ttc ? ttc['Total (FCFA)'] : 'ERR');
