import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config();

/** Bornes lundi→dimanche UTC d'une semaine ISO (aligné PerformanceDashboardService). */
function weekBounds(week: number, year: number): { from: string; to: string } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - day + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

/**
 * Seed démo Performance (lot P9) — missions type DAILY ONECOMIT.
 * Cible les semaines ISO 27→30 (défaut UI) et 33→36 (tendance récente) / 2026.
 * Idempotent : clé sonatel_dossier_number = SEED-PERF-…
 */

type SeedRow = {
  week: number;
  dayOffset: number; // 0=lundi … 6=dimanche
  team: string;
  olt: string;
  ok: boolean;
  motif?: string;
  code?: string;
  client: string;
  tache: string;
  tachesEffectuees?: string;
  vaCap?: string;
  nbsi?: number;
  nd?: string;
  adresse?: string;
  observations?: string;
};

const ROWS: SeedRow[] = [
  // —— S27 ——
  { week: 27, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'DIOP Aminata', tache: 'INSTALLATION', tachesEffectuees: 'Pose ONT + activation', vaCap: 'oui', nbsi: 1, nd: '3382011001', adresse: 'Cité Soprim, Mbour' },
  { week: 27, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: false, motif: 'SATURATION PBO', code: 'saturation', client: 'NDIAYE Mamadou', tache: 'INSTALLATION', nbsi: 2, nd: '3382011002', adresse: 'Quartier Tefess', observations: 'Saturation_PBO_14.425844,-16.955900_SOFA' },
  { week: 27, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: true, client: 'FALL Awa', tache: 'INSTALLATION', tachesEffectuees: 'Branchement client', vaCap: 'oui', nbsi: 1, nd: '3382011003' },
  { week: 27, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'Client absent / injoignable', code: 'client_absent', client: 'SARR Ibrahima', tache: 'INSTALLATION', nbsi: 1, nd: '3382011004' },
  { week: 27, dayOffset: 2, team: 'Gamma', olt: 'Touba', ok: true, client: 'BA Cheikh', tache: 'DENSIFICATION', tachesEffectuees: 'Extension drop', vaCap: 'oui', nbsi: 1, nd: '3382011005' },
  { week: 27, dayOffset: 3, team: 'Delta', olt: 'Kaolack', ok: true, client: 'GUEYE Fatou', tache: 'SAV', tachesEffectuees: 'Remplacement ONT', vaCap: 'oui', nbsi: 3, nd: '3382011006' },
  { week: 27, dayOffset: 4, team: 'Alpha', olt: 'Mbodjene', ok: false, motif: 'Zone inéligible', code: 'zone_ineligible', client: 'KANE Ousmane', tache: 'INSTALLATION', nbsi: 1, nd: '3382011007' },
  { week: 27, dayOffset: 5, team: 'Gamma', olt: 'Porokhane', ok: true, client: 'DIALLO Mariama', tache: 'INSTALLATION', tachesEffectuees: 'Activation FTTH', vaCap: 'oui', nbsi: 1, nd: '3382011008' },

  // —— S28 ——
  { week: 28, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'SECK Pape', tache: 'INSTALLATION', tachesEffectuees: 'Pose + test débit', vaCap: 'oui', nbsi: 1, nd: '3382012001' },
  { week: 28, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'THIAM Khady', tache: 'INSTALLATION', tachesEffectuees: 'Activation', vaCap: 'oui', nbsi: 1, nd: '3382012002' },
  { week: 28, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'SATURATION PBO', code: 'saturation', client: 'CISSE Aliou', tache: 'INSTALLATION', nbsi: 2, nd: '3382012003', observations: 'Saturation_14.748,-17.365_SOFA' },
  { week: 28, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: true, client: 'MBAYE Rokhaya', tache: 'DENSIFICATION', tachesEffectuees: 'Tirage fibre', vaCap: 'oui', nbsi: 1, nd: '3382012004' },
  { week: 28, dayOffset: 2, team: 'Gamma', olt: 'Touba', ok: false, motif: 'Infrastructure manquante', code: 'infra', client: 'SOW Abdou', tache: 'INSTALLATION', nbsi: 1, nd: '3382012005' },
  { week: 28, dayOffset: 3, team: 'Delta', olt: 'Kaolack', ok: true, client: 'NDAO Bineta', tache: 'INSTALLATION', tachesEffectuees: 'Pose ONT', vaCap: 'oui', nbsi: 1, nd: '3382012006' },
  { week: 28, dayOffset: 4, team: 'Alpha', olt: 'Popenguine', ok: true, client: 'FAYE Modou', tache: 'SURVEY', tachesEffectuees: 'Relevé terrain', vaCap: 'non', nbsi: 1, nd: '3382012007' },
  { week: 28, dayOffset: 5, team: 'Delta', olt: 'Fatick', ok: false, motif: 'Client refuse installation', code: 'refus_client', client: 'LO Aissatou', tache: 'INSTALLATION', nbsi: 1, nd: '3382012008' },
  { week: 28, dayOffset: 5, team: 'Gamma', olt: 'Touba', ok: true, client: 'CAMARA Lamine', tache: 'SAV', tachesEffectuees: 'Déblocage ligne', vaCap: 'oui', nbsi: 4, nd: '3382012009' },

  // —— S29 ——
  { week: 29, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'SENE Moussa', tache: 'INSTALLATION', tachesEffectuees: 'Activation FTTH', vaCap: 'oui', nbsi: 1, nd: '3382013001' },
  { week: 29, dayOffset: 0, team: 'Alpha', olt: 'Mbodjene', ok: true, client: 'DIENG Coumba', tache: 'INSTALLATION', tachesEffectuees: 'Pose + brassage', vaCap: 'oui', nbsi: 1, nd: '3382013002' },
  { week: 29, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: true, client: 'WADE Omar', tache: 'INSTALLATION', tachesEffectuees: 'Mise en service', vaCap: 'oui', nbsi: 1, nd: '3382013003' },
  { week: 29, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'Client absent / injoignable', code: 'client_absent', client: 'SY Adama', tache: 'INSTALLATION', nbsi: 2, nd: '3382013004' },
  { week: 29, dayOffset: 2, team: 'Gamma', olt: 'Porokhane', ok: true, client: 'TRAORE Fatim', tache: 'DENSIFICATION', tachesEffectuees: 'Ajout splitter', vaCap: 'oui', nbsi: 1, nd: '3382013005' },
  { week: 29, dayOffset: 2, team: 'Gamma', olt: 'Touba', ok: false, motif: 'SATURATION PBO', code: 'saturation', client: 'KEBE Babacar', tache: 'INSTALLATION', nbsi: 3, nd: '3382013006' },
  { week: 29, dayOffset: 3, team: 'Delta', olt: 'Kaolack', ok: true, client: 'NDOYE Salimata', tache: 'INSTALLATION', tachesEffectuees: 'Pose ONT', vaCap: 'oui', nbsi: 1, nd: '3382013007' },
  { week: 29, dayOffset: 4, team: 'Alpha', olt: 'Mbour', ok: false, motif: 'Adresse incorrecte', code: 'adresse', client: 'GUEYE Idrissa', tache: 'INSTALLATION', nbsi: 1, nd: '3382013008' },
  { week: 29, dayOffset: 5, team: 'Delta', olt: 'Nioro', ok: true, client: 'BALDE Hawa', tache: 'SAV', tachesEffectuees: 'Remplacement fibre', vaCap: 'oui', nbsi: 2, nd: '3382013009' },
  { week: 29, dayOffset: 5, team: 'Beta', olt: 'Thiaroye', ok: true, client: 'DRAME Cheikh', tache: 'INSTALLATION', tachesEffectuees: 'Activation', vaCap: 'oui', nbsi: 1, nd: '3382013010' },

  // —— S30 (défaut UI) ——
  { week: 30, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'DIOP Marième', tache: 'INSTALLATION', tachesEffectuees: 'Pose ONT + test', vaCap: 'oui', nbsi: 1, nd: '3382014001', adresse: 'Route de Saly' },
  { week: 30, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'NIANG Ablaye', tache: 'INSTALLATION', tachesEffectuees: 'Activation FTTH', vaCap: 'oui', nbsi: 1, nd: '3382014002' },
  { week: 30, dayOffset: 0, team: 'Alpha', olt: 'Mbodjene', ok: false, motif: 'SATURATION PBO', code: 'saturation', client: 'FALL Serigne', tache: 'INSTALLATION', nbsi: 2, nd: '3382014003', observations: 'Saturation_PBO_14.392,-16.981_SOFA' },
  { week: 30, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: true, client: 'SARR Khady', tache: 'INSTALLATION', tachesEffectuees: 'Branchement', vaCap: 'oui', nbsi: 1, nd: '3382014004' },
  { week: 30, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'Client absent / injoignable', code: 'client_absent', client: 'MBENGUE Oumar', tache: 'INSTALLATION', nbsi: 1, nd: '3382014005' },
  { week: 30, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: true, client: 'KAIRE Awa', tache: 'DENSIFICATION', tachesEffectuees: 'Extension réseau', vaCap: 'oui', nbsi: 1, nd: '3382014006' },
  { week: 30, dayOffset: 2, team: 'Gamma', olt: 'Touba', ok: true, client: 'DIOUF Moustapha', tache: 'INSTALLATION', tachesEffectuees: 'Mise en service', vaCap: 'oui', nbsi: 1, nd: '3382014007' },
  { week: 30, dayOffset: 2, team: 'Gamma', olt: 'Porokhane', ok: false, motif: 'Infrastructure manquante', code: 'infra', client: 'THIOUNE Astou', tache: 'INSTALLATION', nbsi: 1, nd: '3382014008' },
  { week: 30, dayOffset: 2, team: 'Gamma', olt: 'Touba', ok: true, client: 'SALL Boubacar', tache: 'SAV', tachesEffectuees: 'Remplacement ONT', vaCap: 'oui', nbsi: 5, nd: '3382014009' },
  { week: 30, dayOffset: 3, team: 'Delta', olt: 'Kaolack', ok: true, client: 'FAYE Ndeye', tache: 'INSTALLATION', tachesEffectuees: 'Pose + brassage', vaCap: 'oui', nbsi: 1, nd: '3382014010' },
  { week: 30, dayOffset: 3, team: 'Delta', olt: 'Kaolack', ok: false, motif: 'Zone inéligible', code: 'zone_ineligible', client: 'KANE Cheikh', tache: 'INSTALLATION', nbsi: 1, nd: '3382014011' },
  { week: 30, dayOffset: 4, team: 'Alpha', olt: 'Mbour', ok: true, client: 'GUEYE Rama', tache: 'INSTALLATION', tachesEffectuees: 'Activation', vaCap: 'oui', nbsi: 1, nd: '3382014012' },
  { week: 30, dayOffset: 4, team: 'Delta', olt: 'Fatick', ok: true, client: 'BA Ibrahima', tache: 'INSTALLATION', tachesEffectuees: 'Pose ONT', vaCap: 'oui', nbsi: 1, nd: '3382014013' },
  { week: 30, dayOffset: 5, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'SATURATION PBO', code: 'saturation', client: 'NDIAYE Fatou', tache: 'INSTALLATION', nbsi: 2, nd: '3382014014' },
  { week: 30, dayOffset: 5, team: 'Gamma', olt: 'Touba', ok: true, client: 'CAMARA Aissatou', tache: 'INSTALLATION', tachesEffectuees: 'Test débit OK', vaCap: 'oui', nbsi: 1, nd: '3382014015' },
  { week: 30, dayOffset: 6, team: 'Alpha', olt: 'Popenguine', ok: true, client: 'SECK Lamine', tache: 'SURVEY', tachesEffectuees: 'Relevé OSM', vaCap: 'non', nbsi: 1, nd: '3382014016' },

  // —— S33→S36 (tendance récente autour de septembre 2026) ——
  { week: 33, dayOffset: 1, team: 'Alpha', olt: 'Mbour', ok: true, client: 'DIOP Seed S33a', tache: 'INSTALLATION', tachesEffectuees: 'Activation', vaCap: 'oui', nbsi: 1, nd: '3382015001' },
  { week: 33, dayOffset: 2, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'SATURATION PBO', code: 'saturation', client: 'FALL Seed S33b', tache: 'INSTALLATION', nbsi: 2, nd: '3382015002' },
  { week: 33, dayOffset: 3, team: 'Gamma', olt: 'Touba', ok: true, client: 'BA Seed S33c', tache: 'INSTALLATION', tachesEffectuees: 'Pose ONT', vaCap: 'oui', nbsi: 1, nd: '3382015003' },
  { week: 33, dayOffset: 4, team: 'Delta', olt: 'Kaolack', ok: true, client: 'GUEYE Seed S33d', tache: 'SAV', tachesEffectuees: 'Remplacement ONT', vaCap: 'oui', nbsi: 2, nd: '3382015004' },

  { week: 34, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'SARR Seed S34a', tache: 'INSTALLATION', tachesEffectuees: 'Mise en service', vaCap: 'oui', nbsi: 1, nd: '3382016001' },
  { week: 34, dayOffset: 1, team: 'Alpha', olt: 'Mbodjene', ok: true, client: 'NDIAYE Seed S34b', tache: 'INSTALLATION', tachesEffectuees: 'Pose + test', vaCap: 'oui', nbsi: 1, nd: '3382016002' },
  { week: 34, dayOffset: 2, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'Client absent / injoignable', code: 'client_absent', client: 'THIAM Seed S34c', tache: 'INSTALLATION', nbsi: 1, nd: '3382016003' },
  { week: 34, dayOffset: 3, team: 'Gamma', olt: 'Porokhane', ok: true, client: 'CAMARA Seed S34d', tache: 'DENSIFICATION', tachesEffectuees: 'Extension drop', vaCap: 'oui', nbsi: 1, nd: '3382016004' },
  { week: 34, dayOffset: 4, team: 'Delta', olt: 'Fatick', ok: false, motif: 'Zone inéligible', code: 'zone_ineligible', client: 'LO Seed S34e', tache: 'INSTALLATION', nbsi: 1, nd: '3382016005' },

  { week: 35, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'SECK Seed S35a', tache: 'INSTALLATION', tachesEffectuees: 'Activation FTTH', vaCap: 'oui', nbsi: 1, nd: '3382017001' },
  { week: 35, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: true, client: 'MBAYE Seed S35b', tache: 'INSTALLATION', tachesEffectuees: 'Branchement', vaCap: 'oui', nbsi: 1, nd: '3382017002' },
  { week: 35, dayOffset: 2, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'SATURATION PBO', code: 'saturation', client: 'CISSE Seed S35c', tache: 'INSTALLATION', nbsi: 3, nd: '3382017003' },
  { week: 35, dayOffset: 3, team: 'Gamma', olt: 'Touba', ok: true, client: 'SOW Seed S35d', tache: 'INSTALLATION', tachesEffectuees: 'Pose ONT', vaCap: 'oui', nbsi: 1, nd: '3382017004' },
  { week: 35, dayOffset: 4, team: 'Delta', olt: 'Kaolack', ok: true, client: 'NDAO Seed S35e', tache: 'SAV', tachesEffectuees: 'Déblocage ligne', vaCap: 'oui', nbsi: 2, nd: '3382017005' },
  { week: 35, dayOffset: 5, team: 'Alpha', olt: 'Popenguine', ok: true, client: 'FAYE Seed S35f', tache: 'SURVEY', tachesEffectuees: 'Relevé terrain', vaCap: 'non', nbsi: 1, nd: '3382017006' },

  { week: 36, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'SENE Seed S36a', tache: 'INSTALLATION', tachesEffectuees: 'Pose + activation', vaCap: 'oui', nbsi: 1, nd: '3382018001' },
  { week: 36, dayOffset: 0, team: 'Alpha', olt: 'Mbour', ok: true, client: 'DIENG Seed S36b', tache: 'INSTALLATION', tachesEffectuees: 'Test débit OK', vaCap: 'oui', nbsi: 1, nd: '3382018002' },
  { week: 36, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: true, client: 'WADE Seed S36c', tache: 'INSTALLATION', tachesEffectuees: 'Mise en service', vaCap: 'oui', nbsi: 1, nd: '3382018003' },
  { week: 36, dayOffset: 1, team: 'Beta', olt: 'Thiaroye', ok: false, motif: 'Infrastructure manquante', code: 'infra', client: 'SY Seed S36d', tache: 'INSTALLATION', nbsi: 1, nd: '3382018004' },
  { week: 36, dayOffset: 2, team: 'Gamma', olt: 'Touba', ok: true, client: 'TRAORE Seed S36e', tache: 'DENSIFICATION', tachesEffectuees: 'Ajout splitter', vaCap: 'oui', nbsi: 1, nd: '3382018005' },
  { week: 36, dayOffset: 2, team: 'Gamma', olt: 'Porokhane', ok: false, motif: 'SATURATION PBO', code: 'saturation', client: 'KEBE Seed S36f', tache: 'INSTALLATION', nbsi: 2, nd: '3382018006' },
  { week: 36, dayOffset: 3, team: 'Delta', olt: 'Kaolack', ok: true, client: 'NDOYE Seed S36g', tache: 'INSTALLATION', tachesEffectuees: 'Pose ONT', vaCap: 'oui', nbsi: 1, nd: '3382018007' },
  { week: 36, dayOffset: 4, team: 'Delta', olt: 'Nioro', ok: true, client: 'BALDE Seed S36h', tache: 'SAV', tachesEffectuees: 'Remplacement fibre', vaCap: 'oui', nbsi: 2, nd: '3382018008' },
];

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  console.log(`Connexion OK — ${ROWS.length} modèles…`);

  const companies = (await client.query<{ id: string; name: string }>('SELECT id, name FROM companies')).rows;
  if (!companies.length) {
    console.log('Aucun tenant — seed performance ignoré.');
    await client.end();
    return;
  }

  const existingRes = await client.query<{ company_id: string; sonatel_dossier_number: string }>(
    "SELECT company_id, sonatel_dossier_number FROM missions WHERE sonatel_dossier_number LIKE 'SEED-PERF-%'",
  );
  const existingKeys = new Set(
    existingRes.rows.map((r: { company_id: string; sonatel_dossier_number: string }) =>
      `${r.company_id}|${r.sonatel_dossier_number}`,
    ),
  );

  let created = 0;
  let skipped = 0;
  const year = 2026;

  for (const company of companies) {
    for (let i = 0; i < ROWS.length; i++) {
      const row = ROWS[i];
      const dossier = `SEED-PERF-S${row.week}-${String(i + 1).padStart(3, '0')}`;
      if (existingKeys.has(`${company.id}|${dossier}`)) {
        skipped++;
        continue;
      }

      const bounds = weekBounds(row.week, year);
      const monday = new Date(`${bounds.from}T08:00:00Z`);
      monday.setUTCDate(monday.getUTCDate() + row.dayOffset);
      const dateMission = monday;
      const arrivee = new Date(dateMission);
      arrivee.setUTCHours(9, 15, 0, 0);
      const depart = new Date(dateMission);
      depart.setUTCHours(11, 40, 0, 0);

      const meta = {
        teamLabel: row.team,
        sourceFile: 'seed-performance-missions',
        nd: row.nd ?? null,
        adresse: row.adresse ?? `${row.olt}, Sénégal`,
        dateValidation: row.ok ? dateMission.toISOString().slice(0, 10) : null,
        observations: row.observations ?? null,
        st: 'ONECOMIT',
      };

      await client.query(
        `INSERT INTO missions (
          id, company_id, client_site, type_tache, zone, date_mission, status,
          sonatel_dossier_number, sonatel_olt, sonatel_produit, segment, commande_client,
          blocage_motif, blocage_code, taches_effectuees, va_cap, nbsi, import_source,
          pilote_sonatel, heure_arrivee, heure_depart_reelle, import_meta,
          technician_ids, photo_urls, surcharge, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6,
          $7, $8, 'FTTH', 'B2C', 'FIB_KHE',
          $9, $10, $11, $12, $13, 'DAILY',
          'DAOUDA DIAO', $14, $15, $16::jsonb,
          '{}', '{}', false, NOW(), NOW()
        )`,
        [
          company.id,
          row.client,
          row.tache,
          row.olt,
          dateMission.toISOString(),
          row.ok ? 'terminee' : 'rejetee',
          dossier,
          row.olt,
          row.ok ? null : (row.motif ?? 'AUTRE'),
          row.ok ? null : (row.code ?? 'autre'),
          row.ok ? (row.tachesEffectuees ?? 'Intervention réalisée') : null,
          row.vaCap ?? (row.ok ? 'oui' : 'non'),
          row.nbsi ?? 1,
          row.ok ? arrivee.toISOString() : null,
          row.ok ? depart.toISOString() : null,
          JSON.stringify(meta),
        ],
      );
      created++;
    }
  }

  console.log(
    `Performance seed : ${created} mission(s) créée(s), ${skipped} déjà présentes (${companies.length} tenant(s), S27–S36/2026).`,
  );
  await client.end();
}

seed().catch((err) => {
  console.error('Seed performance échoué :', err);
  process.exit(1);
});
