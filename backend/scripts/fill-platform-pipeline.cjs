/**
 * Remplit toute la plateforme ONECOMIT selon le pipeline produit :
 * 1) Import Planning FTTH (API preview+confirm)
 * 2) Enrichissement depuis ATTACHEMENT JUIN (PROD/SAV/PBO/POI/INFRA)
 * 3) Complétion modules vides (RH, stock série, facture, dispositif, chat, KPI TCO…)
 * 4) Génération facture + recalcul KPI
 *
 * Usage: node scripts/fill-platform-pipeline.mjs
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const XLSX = require('xlsx');

const API = process.env.API_URL || 'http://localhost:3100/api/v1';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@onecomit.sn';
const PASS = process.env.ADMIN_PASSWORD || 'ChangeMe!2026';

const PLANNING = process.env.PLANNING_XLSX
  || 'c:/Users/USER/Downloads/Planning global FTTH 30 07 2026.xlsx';
const ATTACHEMENT = process.env.ATTACHEMENT_XLSX
  || 'c:/Users/USER/Documents/MYWORKSPACE/BABACAR/ATTACHEMENT ONCOMIT JUIN VF.xlsx';

async function json(method, urlPath, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → ${res.status}: ${typeof data === 'object' ? JSON.stringify(data).slice(0, 400) : text.slice(0, 400)}`);
  }
  return data;
}

async function upload(urlPath, filePath, token, query = '') {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(filePath));
  const res = await fetch(`${API}${urlPath}${query}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`UPLOAD ${urlPath} → ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return data;
}

function psql(sql, label = 'sql') {
  const tmp = path.join(__dirname, '_fill_tmp.sql');
  fs.writeFileSync(tmp, sql, 'utf8');
  try {
    return execSync(`docker exec -i vectracom-postgres psql -U vectracom -d vectracom`, {
      input: fs.readFileSync(tmp),
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (e) {
    console.log(`   [${label}] WARN: ${(e.stderr || e.message || '').toString().slice(0, 300)}`);
    return e.stdout || '';
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

function excelDateToIso(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') {
    const epoch = Date.UTC(1899, 11, 30) + v * 86400000;
    return new Date(epoch).toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

function esc(s) {
  if (s == null) return 'NULL';
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function main() {
  console.log('=== VECTRACOM fill-platform-pipeline ===');
  for (const f of [PLANNING, ATTACHEMENT]) {
    if (!fs.existsSync(f)) throw new Error(`Fichier manquant: ${f}`);
  }

  const login = await json('POST', '/auth/login', { email: EMAIL, password: PASS });
  const token = login.accessToken || login.access_token;
  if (!token) throw new Error('Login failed: ' + JSON.stringify(login));
  console.log('1) Login OK');

  // —— 1. Import Planning FTTH ——
  if (process.env.SKIP_PLANNING === '1') {
    console.log('2) Import Planning FTTH… SKIPPED');
  } else {
  console.log('2) Import Planning FTTH…');
  const preview = await upload('/planning/import/preview', PLANNING, token, '?includeTraitees=true');
  console.log('   preview stats:', JSON.stringify(preview.stats));
  console.log(`   SURCH=${preview.surchCount} TRAITEES=${preview.traiteesCount} filter=${preview.subcontractorFilter}`);
  const confirm = await json('POST', '/planning/import/confirm', { fileId: preview.fileId }, token);
  console.log(`   confirm: created=${confirm.created} updated=${confirm.updated} selected=${confirm.selected}`);
  }

  // —— 2. Attachement juin → missions billables + incidents TS ——
  console.log('3) Attachement JUIN → enrichissement…');
  const att = XLSX.readFile(ATTACHEMENT, { cellDates: true });
  const sheet = (name) => {
    const n = att.SheetNames.find((x) => x.trim().toUpperCase() === name.trim().toUpperCase())
      || att.SheetNames.find((x) => x.toUpperCase().includes(name.toUpperCase()));
    return n ? XLSX.utils.sheet_to_json(att.Sheets[n], { defval: null }) : [];
  };

  const prod = sheet('PROD').filter((r) => {
    const p = String(r['PRESTATAIRE'] || '').toUpperCase();
    return p.includes('ONCOMIT') || p.includes('ONECOMIT') || p.includes('3STB') || p.includes('SOFATEL');
  });
  // Cap pour perf SQL : 400 lignes PROD représentatives
  const prodSample = prod.slice(0, 400);
  console.log(`   PROD filtrées=${prod.length}, sample=${prodSample.length}`);

  const sav = sheet('SAV').slice(0, 200);
  const pbo = sheet('CHANGEMENT PBO');
  const poi = sheet('POI');
  const infra = sheet('INFRA');
  console.log(`   SAV=${sav.length} PBO=${pbo.length} POI=${poi.length} INFRA=${infra.length}`);

  // Build SQL values for PROD upsert
  const prodValues = [];
  for (const r of prodSample) {
    const dossier = String(r['Demande'] ?? '').trim();
    if (!dossier || dossier === 'null') continue;
    const client = String(r['Nom du Client'] || r['NomduClient'] || 'Client attachement').trim().slice(0, 180);
    const task = String(r['Tâches planifiées'] || r['Taches planifiees'] || r['Tâches validées CAP'] || 'Installation').trim().slice(0, 120);
    const olt = String(r['OLT'] || '').trim().slice(0, 80) || null;
    const equipe = String(r['Equipe'] || r['EQUIPE'] || '').trim().slice(0, 120) || null;
    const dateIso = excelDateToIso(r['Date Intervention'] || r['Date Validation']) || '2026-06-15';
    const va = String(r['Tâches validées CAP'] || '').trim();
    const vaCap = va ? 'oui' : 'non';
    const segment = String(r['Segment'] || '').trim().slice(0, 40) || null;
    const nd = String(r['ND'] || '').trim().slice(0, 40) || null;
    prodValues.push({ dossier, client, task, olt, equipe, dateIso, vaCap, segment, nd });
  }

  // Chunked upsert via temp approach - one big DO block
  let prodSql = `
DO $$
DECLARE
  cid uuid := (SELECT id FROM companies WHERE lower(name)='onecomit' LIMIT 1);
  pid uuid := (SELECT id FROM partners WHERE company_id=cid AND upper(code)='SOFATELCOM' LIMIT 1);
  mid uuid;
BEGIN
`;
  for (const v of prodValues) {
    prodSql += `
  SELECT id INTO mid FROM missions WHERE company_id=cid AND sonatel_dossier_number=${esc(v.dossier)} LIMIT 1;
  IF mid IS NULL THEN
    INSERT INTO missions (
      id, company_id, created_at, updated_at, client_site, type_tache, zone, date_mission, status,
      sonatel_dossier_number, sonatel_olt, partner_id, va_cap, segment, technician_ids, import_meta, import_source
    ) VALUES (
      gen_random_uuid(), cid, now(), now(), ${esc(v.client)}, ${esc(v.task)}, ${esc(v.olt)}, ${esc(v.dateIso)}::timestamptz, 'terminee',
      ${esc(v.dossier)}, ${esc(v.olt)}, pid, ${esc(v.vaCap)}, ${esc(v.segment)}, '{}'::uuid[],
      jsonb_build_object('teamLabel', ${esc(v.equipe)}, 'sourceFile', 'ATTACHEMENT ONCOMIT JUIN VF.xlsx', 'nd', ${esc(v.nd)}),
      'ATTACHEMENT'
    );
  ELSE
    UPDATE missions SET
      status = CASE WHEN status IN ('terminee','validee','rejetee') THEN status ELSE 'terminee' END,
      date_mission = COALESCE(date_mission, ${esc(v.dateIso)}::timestamptz),
      va_cap = COALESCE(NULLIF(va_cap,''), ${esc(v.vaCap)}),
      sonatel_olt = COALESCE(sonatel_olt, ${esc(v.olt)}),
      segment = COALESCE(segment, ${esc(v.segment)}),
      partner_id = COALESCE(partner_id, pid),
      import_meta = COALESCE(import_meta, '{}'::jsonb) || jsonb_build_object('nd', ${esc(v.nd)}, 'sourceFile', 'ATTACHEMENT ONCOMIT JUIN VF.xlsx'),
      updated_at = now()
    WHERE id = mid;
  END IF;
`;
  }
  prodSql += 'END $$;\n';
  console.log('   upsert PROD…');
  psql(prodSql);

  // Incidents from CHANGEMENT PBO + sample POI/INFRA
  let incSql = `
DO $$
DECLARE
  cid uuid := (SELECT id FROM companies WHERE lower(name)='onecomit' LIMIT 1);
  n int;
BEGIN
`;
  let i = 0;
  for (const r of pbo.slice(0, 40)) {
    i += 1;
    const zone = String(r['ZONE '] || r['ZONE'] || 'Dakar').trim() || 'Dakar';
    const pboRef = String(r['PBO '] || r['PBO'] || `PBO-ATT-${i}`).trim();
    const num = `INC-ATT-PBO-${String(i).padStart(3, '0')}`;
    const statut = String(r['STATUT'] || '').toUpperCase();
    const status = statut.includes('CLOT') || statut.includes('OK') || statut.includes('FAIT') ? 'cloture' : 'en_cours';
    const qty = Number(r['QUANTITE '] || r['QUANTITE'] || 1) || 1;
    incSql += `
  IF NOT EXISTS (SELECT 1 FROM incidents WHERE company_id=cid AND incident_number=${esc(num)}) THEN
    INSERT INTO incidents (
      id, company_id, created_at, updated_at, incident_number, source, whatsapp_group, reported_at,
      rubrique, zone, pbo_reference, pbo_defaut, clients_impacted, nd_list, photos, status, severity,
      annotation_originale, assigned_technician_ids, related_mission_ids
    ) VALUES (
      gen_random_uuid(), cid, now(), now(), ${esc(num)}, 'EMAIL', 'REMONTEE', now() - (${i} || ' days')::interval,
      'PBO', ${esc(zone)}, ${esc(pboRef)}, 'ENDOMAGE', ${qty}, '{}', '[]'::jsonb, ${esc(status)}, 'MAJEUR',
      ${esc(String(r['ACTION '] || r['ACTION'] || 'Changement PBO attachement juin').slice(0, 200))},
      '{}'::uuid[], '{}'::uuid[]
    );
  END IF;
`;
  }
  for (const r of poi.slice(0, 25)) {
    i += 1;
    const num = `INC-ATT-POI-${String(i).padStart(3, '0')}`;
    const zone = String(r['ADRESSE ANOMALIE'] || 'POI').trim().slice(0, 120);
    const annot = String(r['NATURE REMONTEE'] || r['DESIGNATION '] || 'POI').trim().slice(0, 200);
    incSql += `
  IF NOT EXISTS (SELECT 1 FROM incidents WHERE company_id=cid AND incident_number=${esc(num)}) THEN
    INSERT INTO incidents (
      id, company_id, created_at, updated_at, incident_number, source, reported_at,
      rubrique, zone, pio_type, pio_etat, clients_impacted, nd_list, photos, status, severity,
      annotation_originale, assigned_technician_ids, related_mission_ids
    ) VALUES (
      gen_random_uuid(), cid, now(), now(), ${esc(num)}, 'MOBILE', now() - (${i} || ' hours')::interval,
      'PIO', ${esc(zone)}, 'CABLE', 'DEBOUT', 0, '{}', '[]'::jsonb, 'signalement', 'MINEUR',
      ${esc(annot)}, '{}'::uuid[], '{}'::uuid[]
    );
  END IF;
`;
  }
  for (const r of infra.slice(0, 30)) {
    i += 1;
    const num = `INC-ATT-INF-${String(i).padStart(3, '0')}`;
    const zone = String(r['ZONE'] || r['LOCALISATION POINT D\'IMPACT'] || 'INFRA').trim().slice(0, 120);
    const typ = String(r["TYPE D'INTERVENTION (DRGMT INFRA INFRA,DRGMT INFRA LS,INCIDENT,ATP,MP)"] || 'INCIDENT').toUpperCase();
    const rubrique = typ.includes('PBO') ? 'PBO' : (typ.includes('CHAMBRE') ? 'CHAMBRE' : 'PIO');
    incSql += `
  IF NOT EXISTS (SELECT 1 FROM incidents WHERE company_id=cid AND incident_number=${esc(num)}) THEN
    INSERT INTO incidents (
      id, company_id, created_at, updated_at, incident_number, source, reported_at,
      rubrique, zone, clients_impacted, nd_list, photos, status, severity,
      annotation_originale, assigned_technician_ids, related_mission_ids
    ) VALUES (
      gen_random_uuid(), cid, now(), now(), ${esc(num)}, 'WHATSAPP', now() - (${i} || ' hours')::interval,
      ${esc(rubrique)}, ${esc(zone)}, 0, '{}', '[]'::jsonb, 'en_cours', 'MAJEUR',
      ${esc(String(r['CAUSE'] || r['ACTION DE RELEVE'] || 'INFRA attachement').slice(0, 200))},
      '{}'::uuid[], '{}'::uuid[]
    );
  END IF;
`;
  }
  incSql += 'END $$;\n';
  console.log('   insert incidents attachement…');
  psql(incSql);

  // —— 3. Modules transverses ——
  console.log('4) Complétion modules vides…');
  psql(`
-- Field reports for closed missions without report
INSERT INTO mission_field_reports (
  id, company_id, mission_id, created_at, updated_at, mission_type,
  sst_checklist, sst_validated_at, intervention_type, identification_at,
  action_realized, dbm_measurement, technique_at, photos_at, materiel_at,
  field_status, quality_score, internal_validation_status, sonatel_approval_status,
  recette_status, data, price_items_used, montant_total, duree_minutes, observations
)
SELECT gen_random_uuid(), m.company_id, m.id, now(), now(), m.type_tache,
  '{"casque":true,"gants":true,"gilet":true}'::jsonb, now() - interval '2 days',
  COALESCE(m.type_tache,'INSTALLATION'), now() - interval '2 days',
  'Intervention réalisée — données attachement/pipeline', -18.50, now() - interval '1 day',
  now() - interval '1 day', now() - interval '1 day',
  'succes', 92.00, 'validee', 'approuve', 'acceptee', '{}'::jsonb, '[]'::jsonb,
  6500, 95, 'Rapport généré pour validation plateforme'
FROM missions m
WHERE m.company_id = (SELECT id FROM companies WHERE lower(name)='onecomit')
  AND m.status IN ('terminee','validee')
  AND NOT EXISTS (SELECT 1 FROM mission_field_reports r WHERE r.mission_id = m.id)
LIMIT 250;

-- Dispositif 30/07/2026 from teams × zones
INSERT INTO dispositif_entries (id, company_id, created_at, updated_at, day, zone_name, team_name, axis, team_id, pilot, instances, note)
SELECT gen_random_uuid(), c.id, now(), now(), '2026-07-30', z.zone, t.name, z.axis, t.id, 'Pilote SONATEL', 1, 'Import pipeline'
FROM companies c
CROSS JOIN teams t
CROSS JOIN (VALUES
  ('Thiaroye','PL06'),('Mbour','PL08'),('Kaolack','PL29'),('Dakar Plateau','A_MER')
) AS z(zone, axis)
WHERE lower(c.name)='onecomit' AND t.company_id=c.id
ON CONFLICT (company_id, day, zone_name, team_name) DO NOTHING;

-- Daily workers
INSERT INTO daily_workers (id, company_id, created_at, updated_at, full_name, team_id, phone, daily_rate, active)
SELECT gen_random_uuid(), c.id, now(), now(), v.nm, t.id, v.ph, v.rate, true
FROM companies c
JOIN teams t ON t.company_id=c.id
JOIN LATERAL (SELECT row_number() OVER (ORDER BY t2.name) rn FROM teams t2 WHERE t2.id=t.id) x ON true
CROSS JOIN LATERAL (
  SELECT * FROM (VALUES
    ('Journalier ' || t.name || ' 1', '770000001', 12000),
    ('Journalier ' || t.name || ' 2', '770000002', 12000),
    ('Journalier ' || t.name || ' 3', '770000003', 10000)
  ) AS q(nm, ph, rate)
) v
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (
    SELECT 1 FROM daily_workers dw WHERE dw.company_id=c.id AND dw.full_name=v.nm
  );

INSERT INTO daily_attendances (id, company_id, created_at, updated_at, daily_worker_id, mission_id, day, days_worked, note)
SELECT gen_random_uuid(), dw.company_id, now(), now(), dw.id, NULL, CURRENT_DATE - gs, 1, 'Pointage demo pipeline'
FROM daily_workers dw
CROSS JOIN generate_series(0, 4) gs
WHERE dw.company_id = (SELECT id FROM companies WHERE lower(name)='onecomit')
  AND NOT EXISTS (
    SELECT 1 FROM daily_attendances da WHERE da.daily_worker_id=dw.id AND da.day = CURRENT_DATE - gs
  );

-- Recrutement
INSERT INTO recruitment_candidates (id, company_id, created_at, updated_at, full_name, position, phone, email, source, status, notes, interview_date, test_score, documents)
SELECT gen_random_uuid(), c.id, now(), now(), v.n, v.p, v.ph, v.em, v.src, v.st, v.note, v.idt::date, v.score, '[]'::jsonb
FROM companies c
CROSS JOIN (VALUES
  ('Ba Amadou','technicien','771111111','amadou.ba@example.sn','annonce','entretien','Profil FO junior','2026-09-12',NULL),
  ('Ndiaye Fatou','chef_equipe','772222222','fatou.ndiaye@example.sn','recommandation','test_technique','5 ans FTTH','2026-09-10',78),
  ('Sarr Ibrahima','magasinier','773333333',NULL,'candidature_spontanee','nouveau','Dispo immédiate',NULL,NULL),
  ('Diop Awa','administratif','774444444','awa.diop@example.sn','pole_emploi','retenu','Bonne organisation','2026-09-01',85),
  ('Gueye Modou','chauffeur','775555555',NULL,'annonce','rejete','Permis B manquant',NULL,NULL)
) AS v(n,p,ph,em,src,st,note,idt,score)
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (SELECT 1 FROM recruitment_candidates rc WHERE rc.company_id=c.id AND rc.full_name=v.n);

-- Vehicle documents + events
INSERT INTO vehicle_documents (id, company_id, created_at, updated_at, vehicle_id, doc_type, file_url, expiration_date)
SELECT gen_random_uuid(), v.company_id, now(), now(), v.id, d.doc, 'https://files.local/demo/' || v.immatriculation || '-' || d.doc || '.pdf', CURRENT_DATE + d.days
FROM vehicles v
CROSS JOIN (VALUES ('assurance',120),('carte_grise',400),('visite_technique',60),('vignette',200)) AS d(doc, days)
WHERE v.company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
  AND NOT EXISTS (SELECT 1 FROM vehicle_documents vd WHERE vd.vehicle_id=v.id AND vd.doc_type=d.doc);

INSERT INTO vehicle_events (id, company_id, created_at, updated_at, vehicle_id, type, event_date, odometer_km, cost, liters, provider, description, parts, status)
SELECT gen_random_uuid(), v.company_id, now(), now(), v.id, e.typ, CURRENT_DATE - e.d, e.odo, e.cost, e.liters, e.prov, e.descr, '[]'::jsonb, 'terminee'
FROM vehicles v
JOIN LATERAL (SELECT row_number() OVER (ORDER BY v2.created_at) rn FROM vehicles v2 WHERE v2.id=v.id) x ON true
CROSS JOIN LATERAL (
  SELECT * FROM (VALUES
    ('carburant', 2, 45200, 45000::numeric, 40::numeric, 'Total Energies', 'Plein gasoil'),
    ('entretien', 10, 46000, 85000::numeric, NULL::numeric, 'Garage Dakar', 'Vidange + filtres'),
    ('panne', 18, 45500, 125000::numeric, NULL::numeric, 'Auto Service', 'Remplacement batterie')
  ) AS q(typ,d,odo,cost,liters,prov,descr)
) e
WHERE v.company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
  AND NOT EXISTS (SELECT 1 FROM vehicle_events ve WHERE ve.vehicle_id=v.id AND ve.description=e.descr);

-- Serials ONT/modem
INSERT INTO item_serials (id, company_id, created_at, updated_at, stock_item_id, serial_number, status, carton_number, current_warehouse_id)
SELECT gen_random_uuid(), si.company_id, now(), now(), si.id,
       'SN-' || si.reference || '-' || lpad(gs::text, 5, '0'),
       CASE WHEN gs <= 8 THEN 'disponible' WHEN gs <= 14 THEN 'en_cours' ELSE 'recupere_defectueux' END,
       'CARTON-2026-' || ((gs-1)/5 + 1),
       (SELECT id FROM warehouses w WHERE w.company_id=si.company_id ORDER BY created_at LIMIT 1)
FROM stock_items si
CROSS JOIN generate_series(1, 18) gs
WHERE si.company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
  AND si.reference IN ('FO-ONT','CU-MODEM')
  AND NOT EXISTS (
    SELECT 1 FROM item_serials s
    WHERE s.company_id=si.company_id
      AND s.serial_number='SN-' || si.reference || '-' || lpad(gs::text, 5, '0')
  );

-- KPI TCO septembre 2026
INSERT INTO kpi_tco_inputs (id, company_id, created_at, updated_at, period, segment, amount, note)
SELECT gen_random_uuid(), c.id, now(), now(), '2026-09', v.seg, v.amt, v.note
FROM companies c
CROSS JOIN (VALUES
  ('PRODUCTION_EM', 45000000, 'Attachement PROD EM'),
  ('PRODUCTION_HM_MM', 12000000, 'HM/MM'),
  ('PRODUCTION_B2B', 8000000, 'B2B'),
  ('AUTRE_TECHNO', 2000000, '5G/sat'),
  ('MAINTENANCE', 28000000, 'SAV + préventif'),
  ('EXTENSION_LOT', 65000000, 'Lots extension'),
  ('DENSIFICATION_LOT', 22000000, 'Densif')
) AS v(seg, amt, note)
WHERE lower(c.name)='onecomit'
ON CONFLICT (company_id, period, segment) DO NOTHING;

INSERT INTO kpi_mastery_plans (id, company_id, created_at, updated_at, kpi_name, period, analysis, actions, responsible, due_date, status)
SELECT gen_random_uuid(), c.id, now(), now(), v.kpi, '2026-09', v.an, v.ac, v.resp, CURRENT_DATE + 14, 'ouvert'
FROM companies c
CROSS JOIN (VALUES
  ('controle.taux_rejet','Taux de rejet trop élevé sur septembre','Renforcer contrôle interne avant dépôt COP','Chef qualité'),
  ('ext.planning_livraison','Retards livraison plaques','Revue planning lots + points hebdo SONATEL','Direction travaux'),
  ('stock.conformite_mensuelle','Écarts inventaire SI vs physique','Inventaire tournant hebdo dépôts','Magasinier')
) AS v(kpi, an, ac, resp)
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (SELECT 1 FROM kpi_mastery_plans p WHERE p.company_id=c.id AND p.kpi_name=v.kpi AND p.period='2026-09');

-- Vision uploads stubs
INSERT INTO vision_uploads (id, company_id, created_at, updated_at, original_name, image_url, mime_type, size_bytes, verdict, score, flags, note, mission_id, uploaded_by)
SELECT gen_random_uuid(), m.company_id, now(), now(),
       'pbo-demo-' || row_number() OVER (), 'https://files.local/demo/pbo-' || m.id || '.jpg',
       'image/jpeg', 240000,
       CASE WHEN random() > 0.3 THEN 'conforme' ELSE 'non_conforme' END,
       (70 + floor(random()*30))::int,
       '[]'::jsonb, 'Analyse démo IA Vision',
       m.id,
       (SELECT id FROM users WHERE company_id=m.company_id ORDER BY created_at LIMIT 1)
FROM missions m
WHERE m.company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
  AND m.status='terminee'
  AND NOT EXISTS (SELECT 1 FROM vision_uploads v WHERE v.mission_id=m.id)
LIMIT 12;

-- Extra geopositions for live map density
INSERT INTO geopositions (id, company_id, created_at, updated_at, technician_id, latitude, longitude, accuracy_m, recorded_at, source)
SELECT gen_random_uuid(), t.company_id, now(), now(), t.id,
       14.69 + (random()*0.08), -17.45 + (random()*0.08), 12, now() - (gs || ' minutes')::interval, 'mobile'
FROM technicians t
CROSS JOIN generate_series(1, 3) gs
WHERE t.company_id=(SELECT id FROM companies WHERE lower(name)='onecomit') AND t.active
  AND (SELECT COUNT(*) FROM geopositions g WHERE g.company_id=t.company_id) < 40;
`);

  // Chat rooms via API (ensureMyRooms)
  try {
    const rooms = await json('GET', '/chat/rooms', undefined, token);
    console.log(`   chat rooms: ${Array.isArray(rooms) ? rooms.length : JSON.stringify(rooms).slice(0, 120)}`);
    if (Array.isArray(rooms) && rooms[0]?.id) {
      await json('POST', `/chat/rooms/${rooms[0].id}/messages`, {
        body: 'Message démo — validation plateforme VECTRACOM (pipeline attachement/planning).',
      }, token);
    }
  } catch (e) {
    console.log('   chat skip:', e.message);
  }

  // —— 4. Facture juin + KPI ——
  console.log('5) Génération facture juin 2026…');
  try {
    const inv = await json('POST', '/invoices/generate', {
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    }, token);
    console.log(`   invoice: ${inv.invoiceNumber || inv.id || JSON.stringify(inv).slice(0, 200)}`);
  } catch (e) {
    console.log('   invoice:', e.message);
    // fallback: try July (planning date)
    try {
      const inv2 = await json('POST', '/invoices/generate', {
        periodStart: '2026-07-01',
        periodEnd: '2026-07-31',
      }, token);
      console.log(`   invoice fallback juillet: ${inv2.invoiceNumber || inv2.id}`);
    } catch (e2) {
      console.log('   invoice fallback:', e2.message);
    }
  }

  console.log('6) Recalcul KPI…');
  try {
    const kpi = await json('POST', '/kpi-sonatel/recalculate?period=2026-09', {}, token);
    console.log(`   KPI: total=${kpi.total} atteints=${kpi.atteints} non=${kpi.nonAtteints}`);
  } catch (e) {
    console.log('   KPI:', e.message);
  }

  // —— 5. Audit final ——
  console.log('7) Audit counts…');
  const out = psql(`
SELECT tbl||'|'||cnt FROM (
  SELECT 'missions' tbl, COUNT(*)::text cnt FROM missions
  UNION ALL SELECT 'mission_field_reports', COUNT(*)::text FROM mission_field_reports
  UNION ALL SELECT 'incidents', COUNT(*)::text FROM incidents
  UNION ALL SELECT 'invoices', COUNT(*)::text FROM invoices
  UNION ALL SELECT 'invoice_lines', COUNT(*)::text FROM invoice_lines
  UNION ALL SELECT 'expenses', COUNT(*)::text FROM expenses
  UNION ALL SELECT 'cash_box', COUNT(*)::text FROM cash_box_entries
  UNION ALL SELECT 'stock_levels', COUNT(*)::text FROM stock_levels
  UNION ALL SELECT 'stock_movements', COUNT(*)::text FROM stock_movements
  UNION ALL SELECT 'item_serials', COUNT(*)::text FROM item_serials
  UNION ALL SELECT 'daily_workers', COUNT(*)::text FROM daily_workers
  UNION ALL SELECT 'daily_attendances', COUNT(*)::text FROM daily_attendances
  UNION ALL SELECT 'recruitment', COUNT(*)::text FROM recruitment_candidates
  UNION ALL SELECT 'vehicle_documents', COUNT(*)::text FROM vehicle_documents
  UNION ALL SELECT 'vehicle_events', COUNT(*)::text FROM vehicle_events
  UNION ALL SELECT 'dispositif', COUNT(*)::text FROM dispositif_entries
  UNION ALL SELECT 'notifications', COUNT(*)::text FROM notifications
  UNION ALL SELECT 'geopositions', COUNT(*)::text FROM geopositions
  UNION ALL SELECT 'chat_rooms', COUNT(*)::text FROM chat_rooms
  UNION ALL SELECT 'chat_messages', COUNT(*)::text FROM chat_messages
  UNION ALL SELECT 'kpi_tco', COUNT(*)::text FROM kpi_tco_inputs
  UNION ALL SELECT 'kpi_mastery', COUNT(*)::text FROM kpi_mastery_plans
  UNION ALL SELECT 'vision_uploads', COUNT(*)::text FROM vision_uploads
  UNION ALL SELECT 'partners', COUNT(*)::text FROM partners
  UNION ALL SELECT 'compliance_records', COUNT(*)::text FROM compliance_records
  UNION ALL SELECT 'sonatel_kpi_logs', COUNT(*)::text FROM sonatel_kpi_logs
) s ORDER BY 1;
`);
  console.log(out);

  // Dashboard smoke
  const checks = [
    ['/performance/dashboard', 'performance'],
    ['/kpi-sonatel/dashboard?period=2026-09', 'kpi'],
    ['/invoices', 'invoices'],
    ['/incidents', 'incidents'],
    ['/missions', 'missions'],
    ['/hr/daily-workers', 'journaliers'],
    ['/hr/recruitment', 'recrutement'],
    ['/dispositif?day=2026-07-30', 'dispositif'],
    ['/geolocation/live', 'geo'],
    ['/expenses', 'expenses'],
  ];
  console.log('8) API smoke:');
  for (const [p, label] of checks) {
    try {
      const d = await json('GET', p, undefined, token);
      const n = Array.isArray(d) ? d.length
        : (d?.markers?.length ?? d?.total ?? d?.items?.length ?? (d?.kpis ? d.kpis.length : Object.keys(d || {}).length));
      console.log(`   ${label}: ${n}`);
    } catch (e) {
      console.log(`   ${label}: ERR ${e.message.slice(0, 120)}`);
    }
  }
  console.log('=== DONE ===');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
