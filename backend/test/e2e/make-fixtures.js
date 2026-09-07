/**
 * Génère les fichiers Excel SONATEL de test pour phase2-smoke.sh.
 * Usage : node test/e2e/make-fixtures.js  (depuis backend/)
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'fixtures');
fs.mkdirSync(outDir, { recursive: true });

const planningRows = [
  { Demande: 'D-001', Client: 'Client A', Tache: 'INSTALLATION', Zone: 'Mbour', Date: '2025-09-01', OLT: 'O_GMB', Produit: 'FTTH', ST: '3STB' },
  { Demande: 'D-002', Client: 'Client B', Tache: 'SAV', Zone: 'Saly', Date: '2025-09-02', OLT: 'O_GMB', Produit: 'FTTH', ST: '3STB' },
  { Demande: 'D-003', Client: 'Client C', Tache: 'SURVEY', Zone: 'Thies', Date: '2025-09-03', OLT: 'O_THI', Produit: 'FTTH', ST: '3STB' },
  { Demande: 'D-004', Client: 'Client D', Tache: 'INSTALLATION', Zone: 'Dakar', Date: '2025-09-04', OLT: 'O_DKR', Produit: 'FTTH', ST: '3STB' },
  { Demande: '', Client: 'Client E', Tache: 'SAV', Zone: 'Mbour', Date: '2025-09-05', OLT: 'O_GMB', Produit: 'FTTH', ST: '3STB' },
  { Demande: 'D-101', Client: 'Client F', Tache: 'INSTALLATION', Zone: 'Mbour', Date: '2025-09-06', OLT: 'O_GMB', Produit: 'FTTH', ST: 'AUTRE-ST' },
  { Demande: 'D-102', Client: 'Client G', Tache: 'SAV', Zone: 'Saly', Date: '2025-09-07', OLT: 'O_GMB', Produit: 'FTTH', ST: 'AUTRE-ST' },
];

const affectRows = [
  { Demande: 'D-001', Equipe: 'Alpha', Techniciens: 'Ndiaye M., Sow A.' },
  { Demande: 'D-002', Equipe: 'Beta', Techniciens: 'Diop I.' },
  { Demande: 'D-003', Equipe: 'Gamma', Techniciens: 'Fall S., Ba O.' },
];

function writeWorkbook(file, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  XLSX.writeFile(wb, path.join(outDir, file));
  console.log('écrit', file);
}

// 1. Fichier complet : PLANNING + AFFECT
writeWorkbook('sonatel_full.xlsx', { PLANNING: planningRows, AFFECT: affectRows });

// 2. Fichier sans onglet AFFECT (repli : missions sans techniciens)
writeWorkbook('sonatel_noaffect.xlsx', {
  PLANNING: [
    { Demande: 'D-201', Client: 'Client H', Tache: 'INSTALLATION', Zone: 'Mbour', Date: '2025-09-10', OLT: 'O_GMB', Produit: 'FTTH', ST: '3STB' },
    { Demande: 'D-202', Client: 'Client I', Tache: 'SAV', Zone: 'Saly', Date: '2025-09-11', OLT: 'O_GMB', Produit: 'FTTH', ST: '3STB' },
  ],
});

// 3. Fichier avec en-tête renommé (« N° Demande » au lieu de « Demande ») — test du mapping personnalisé
writeWorkbook('sonatel_renamed.xlsx', {
  PLANNING: planningRows.map((r) => {
    const { Demande, ...rest } = r;
    return { 'N° Demande': Demande, ...rest };
  }),
  AFFECT: affectRows,
});
