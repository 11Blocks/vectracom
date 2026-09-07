/** Liste les feuilles d'un rapport xlsx exporté (usage : node read-report-xlsx.js <file.xlsx> [sheet]) */
const path = require('path');
const XLSX = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'xlsx'));
const wb = XLSX.readFile(process.argv[2]);
if (process.argv[3]) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[process.argv[3]]);
  console.log(JSON.stringify(rows));
} else {
  console.log(wb.SheetNames.join(','));
}
