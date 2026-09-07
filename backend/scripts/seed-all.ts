import 'reflect-metadata';
import { spawnSync } from 'node:child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Exécute tous les seeds dans l'ordre des dépendances — idempotent :
 - chaque seed vérifie l'existence avant insertion.
 *
 * Ordre : super_admin (console) → catalogue global → données par tenant
 * (chaque seed boucle lui-même sur les tenants existants).
 */
const SEEDS = [
  'seed-super-admin.ts',            // 1. Console Green-T
  'seed-saas-plans.ts',             // 2. Catalogue plans (global)
  'seed-mission-templates.ts',      // 3. 11 templates de mission
  'seed-price-items.ts',            // 4. Bordereau 3STB 2025 (52 items)
  'seed-warehouses.ts',             // 5. Dépôts Dakar, Mbour, Kaolack
  'seed-stock-items.ts',            // 6. 10 articles de base
  'seed-teams.ts',                  // 7. Alpha, Beta, Gamma, Delta
  'seed-technicians.ts',            // 8. 4 binômes complets
  'seed-employees.ts',              // 9. 5 employés
  'seed-attendance.ts',             // 10. Présence semaine courante
  'seed-vehicles.ts',               // 11. 3 véhicules
  'seed-compliance-checklists.ts',  // 12. 11 checklists
  'seed-site-checklist-templates.ts', // 13. 4 fiches chantier
  'seed-performance-missions.ts',   // 14. Missions démo Performance S27–S30
  'seed-geofence-zones.ts',         // 15. Zones géofence Dakar / Mbour
];

async function main() {
  console.log('=== VECTRACOM — seed-all (15 seeds, ordre des dépendances) ===\n');
  let failures = 0;
  for (let i = 0; i < SEEDS.length; i++) {
    const seed = SEEDS[i];
    const script = path.join(__dirname, seed);
    process.stdout.write(`[${String(i + 1).padStart(2, '0')}/${SEEDS.length}] ${seed} ... `);
    const result = spawnSync(`npx ts-node "${script}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      shell: true,
      cwd: path.join(__dirname, '..'),
    });
    const output = `${result.stdout}`.trim().split('\n').pop() ?? '';
    if (result.status === 0) {
      console.log(`OK — ${output}`);
    } else {
      failures++;
      console.log(`ÉCHEC\n${result.stderr}`);
    }
  }

  console.log(`\n=== Terminé : ${SEEDS.length - failures}/${SEEDS.length} seed(s) réussi(s) ===`);
  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('seed-all échoué :', err);
  process.exit(1);
});
