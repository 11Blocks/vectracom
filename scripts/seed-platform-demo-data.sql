-- Fill remaining empty operational tables for ONECOMIT (idempotent).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===== STOCK LEVELS =====
INSERT INTO stock_levels (
  id, company_id, created_at, updated_at,
  stock_item_id, warehouse_id, quantity, reserved_quantity, threshold_alert, threshold_critical
)
SELECT gen_random_uuid(), c.id, now(), now(),
       i.id, w.id,
       CASE WHEN rn_i <= 3 THEN 8 + rn_i ELSE 40 + rn_i * 7 END,
       CASE WHEN rn_i = 1 THEN 2 ELSE 0 END,
       15, 5
FROM companies c
JOIN LATERAL (
  SELECT s.id, row_number() OVER (ORDER BY s.created_at) AS rn_i
  FROM stock_items s WHERE s.company_id = c.id
) i ON true
JOIN LATERAL (
  SELECT w.id
  FROM warehouses w WHERE w.company_id = c.id
  ORDER BY w.created_at LIMIT 1
) w ON true
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (
    SELECT 1 FROM stock_levels sl
    WHERE sl.stock_item_id = i.id AND sl.warehouse_id = w.id
  );

INSERT INTO stock_levels (
  id, company_id, created_at, updated_at,
  stock_item_id, warehouse_id, quantity, reserved_quantity, threshold_alert, threshold_critical
)
SELECT gen_random_uuid(), c.id, now(), now(), i.id, w.id, 4, 0, 15, 5
FROM companies c
JOIN LATERAL (
  SELECT s.id, row_number() OVER (ORDER BY s.created_at) AS rn_i
  FROM stock_items s WHERE s.company_id = c.id
) i ON true
JOIN LATERAL (
  SELECT w2.id, row_number() OVER (ORDER BY w2.created_at) AS rn_w
  FROM warehouses w2 WHERE w2.company_id = c.id
) w ON w.rn_w = 2
WHERE lower(c.name)='onecomit' AND i.rn_i IN (1,2,7)
  AND NOT EXISTS (
    SELECT 1 FROM stock_levels sl
    WHERE sl.stock_item_id = i.id AND sl.warehouse_id = w.id
  );

-- ===== STOCK MOVEMENTS =====
INSERT INTO stock_movements (
  id, company_id, created_at, updated_at,
  stock_item_id, item_serial_id, type, quantity,
  from_warehouse_id, to_warehouse_id, mission_id, technician_id, note
)
SELECT gen_random_uuid(), c.id, now() - (v.d || ' days')::interval, now(),
       i.id, NULL, v.mtype, v.qty,
       CASE WHEN v.mtype IN ('consommation','transfert') THEN w1.id ELSE NULL END,
       CASE WHEN v.mtype IN ('entree','transfert','retour','ajustement') THEN COALESCE(w2.id, w1.id) ELSE NULL END,
       NULL, t.id, v.note
FROM companies c
CROSS JOIN (VALUES
  (1, 'entree', 50, 'Réception fournisseur FO — lot sept 2026'),
  (2, 'entree', 30, 'Réception câble 24FO'),
  (3, 'affectation', 10, 'Affectation équipe Alpha'),
  (4, 'consommation', 6, 'Consommation chantier Plateau'),
  (5, 'transfert', 8, 'Transfert Dakar → Mbour'),
  (6, 'consommation', 3, 'SAV Mbour'),
  (7, 'retour', 2, 'Retour matériel non utilisé'),
  (8, 'ajustement', 1, 'Inventaire — ajustement positif')
) AS v(d, mtype, qty, note)
JOIN LATERAL (
  SELECT s.id, row_number() OVER (ORDER BY s.created_at) AS rn
  FROM stock_items s WHERE s.company_id = c.id
) i ON i.rn = ((v.d - 1) % 10) + 1
JOIN LATERAL (
  SELECT w.id FROM warehouses w WHERE w.company_id = c.id ORDER BY w.created_at LIMIT 1
) w1 ON true
LEFT JOIN LATERAL (
  SELECT w.id, row_number() OVER (ORDER BY w.created_at) AS rn
  FROM warehouses w WHERE w.company_id = c.id
) w2 ON w2.rn = CASE WHEN v.mtype = 'transfert' THEN 2 ELSE 1 END
LEFT JOIN LATERAL (
  SELECT tech.id, row_number() OVER (ORDER BY tech.created_at) AS rn
  FROM technicians tech WHERE tech.company_id = c.id AND tech.active
) t ON t.rn = ((v.d - 1) % 5) + 1
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements sm WHERE sm.company_id = c.id AND sm.note = v.note
  );

-- ===== EXPENSES =====
INSERT INTO expenses (
  id, company_id, created_at, updated_at,
  category, amount, receipt_photo_url, vehicle_id, technician_id, mission_id, description, ai_extracted
)
SELECT gen_random_uuid(), c.id, now() - (v.d || ' days')::interval, now(),
       v.cat, v.amount::numeric, NULL, vh.id, tc.id, NULL, v.descr, false
FROM companies c
CROSS JOIN (VALUES
  (1, 'carburant', '45000', 'Plein gasoil DK-4521-AB — mission Plateau'),
  (2, 'carburant', '38000', 'Plein gasoil DK-8832-CD — Mbour'),
  (3, 'outils_rechange', '125000', 'Achat pinces et connecteurs FO'),
  (4, 'depannage_vehicule', '85000', 'Réparation freins TH-1107-EF'),
  (5, 'salaire_journalier', '25000', 'Journalier équipe Gamma — 1 jour'),
  (6, 'transport', '15000', 'Taxi matériel urgent Almadies'),
  (7, 'materiel', '62000', 'Achat gaine micro-duct'),
  (8, 'divers', '8000', 'Frais parking chantier')
) AS v(d, cat, amount, descr)
LEFT JOIN LATERAL (
  SELECT ve.id, row_number() OVER (ORDER BY ve.created_at) AS rn
  FROM vehicles ve WHERE ve.company_id = c.id
) vh ON vh.rn = ((v.d - 1) % 3) + 1
LEFT JOIN LATERAL (
  SELECT tech.id, row_number() OVER (ORDER BY tech.created_at) AS rn
  FROM technicians tech WHERE tech.company_id = c.id AND tech.active
) tc ON tc.rn = ((v.d - 1) % 5) + 1
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (
    SELECT 1 FROM expenses e WHERE e.company_id = c.id AND e.description = v.descr
  );

-- ===== CASH BOX =====
INSERT INTO cash_box_entries (
  id, company_id, created_at, updated_at,
  type, rubrique, amount, repaid_amount, beneficiary, team_id, vehicle_id, period, note, expense_id
)
SELECT gen_random_uuid(), c.id, now() - (v.d || ' days')::interval, now(),
       v.etype, v.rubrique, v.amount::numeric, v.repaid::numeric, v.benef, tm.id, vh.id, to_char(now(), 'YYYY-MM'), v.note, NULL
FROM companies c
CROSS JOIN (VALUES
  (1, 'sortie', 'carburant', '50000', '0', 'Alpha', 'Avance carburant semaine'),
  (2, 'sortie', 'pret_equipe', '100000', '40000', 'Beta', 'Prêt équipe Beta — partiellement remboursé'),
  (3, 'entree', 'divers', '40000', '0', 'Caisse', 'Remboursement prêt Beta'),
  (4, 'sortie', 'outils_rechange', '75000', '0', 'Gamma', 'Achat urgence outillage')
) AS v(d, etype, rubrique, amount, repaid, benef, note)
LEFT JOIN LATERAL (
  SELECT te.id, row_number() OVER (ORDER BY te.name) AS rn
  FROM teams te WHERE te.company_id = c.id
) tm ON tm.rn = ((v.d - 1) % 4) + 1
LEFT JOIN LATERAL (
  SELECT ve.id, row_number() OVER (ORDER BY ve.created_at) AS rn
  FROM vehicles ve WHERE ve.company_id = c.id
) vh ON vh.rn = ((v.d - 1) % 3) + 1
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (
    SELECT 1 FROM cash_box_entries cb WHERE cb.company_id = c.id AND cb.note = v.note
  );

-- ===== NOTIFICATIONS =====
INSERT INTO notifications (
  id, company_id, created_at, updated_at,
  user_id, type, channel, title, body, data, status, read_at, recipient
)
SELECT gen_random_uuid(), c.id, now() - (v.h || ' hours')::interval, now(),
       u.id, v.ntype, 'in_app', v.title, v.body, '{}'::jsonb, 'sent',
       CASE WHEN v.is_read THEN now() - '1 hour'::interval ELSE NULL END, NULL
FROM companies c
JOIN users u ON u.company_id = c.id AND lower(u.email)='admin@onecomit.sn'
CROSS JOIN (VALUES
  (1, 'incident', 'Incident critique PBO Carnot', '42 clients impactés — INC-2026-0901', false),
  (2, 'stock', 'Stock faible — Câble FO 246m', 'Seuil d''alerte atteint au dépôt Dakar', false),
  (3, 'mission_urgente', 'Mission en retard', '3 missions planifiées dépassent la date prévue', true),
  (4, 'echeance', 'Assurance véhicule bientôt expirée', 'Contrôler DK-4521-AB sous 30 jours', false),
  (5, 'paiement', 'Pénalités KPI SONATEL', '21 KPI non atteints — période 2026-09', false),
  (6, 'incident', 'Poteau à terre Kaolack', 'INC-2026-0904 — urgence sécurité', false)
) AS v(h, ntype, title, body, is_read)
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n WHERE n.company_id = c.id AND n.title = v.title
  );

-- ===== LEAVE REQUESTS =====
INSERT INTO leave_requests (
  id, company_id, created_at, updated_at,
  employee_id, start_date, end_date, reason, status
)
SELECT gen_random_uuid(), c.id, now(), now(),
       e.id, CURRENT_DATE + 7, CURRENT_DATE + 10, v.reason, v.status
FROM companies c
JOIN LATERAL (
  SELECT emp.id, row_number() OVER (ORDER BY emp.created_at) AS rn
  FROM employees emp WHERE emp.company_id = c.id
) e ON true
JOIN (VALUES
  (1, 'Congé annuel', 'en_attente'),
  (2, 'Congé maladie', 'approuve'),
  (3, 'Événement familial', 'refuse')
) AS v(rn, reason, status) ON e.rn = v.rn
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (
    SELECT 1 FROM leave_requests lr
    WHERE lr.company_id = c.id AND lr.employee_id = e.id AND lr.reason = v.reason
  );

-- ===== VEHICLE CHECKS =====
INSERT INTO vehicle_checks (
  id, company_id, created_at, updated_at,
  vehicle_id, mission_id, pneus, freins, huile, eau, batterie, eclairage, observations, photo_url
)
SELECT gen_random_uuid(), c.id, now() - (v.d || ' days')::interval, now(),
       vh.id, NULL, true, true, (v.d <> 2), true, true, true, v.obs, NULL
FROM companies c
JOIN (VALUES
  (1, 'Contrôle matinal OK'),
  (2, 'Niveau huile bas — à surveiller'),
  (3, 'Contrôle avant départ Mbour')
) AS v(d, obs) ON true
JOIN LATERAL (
  SELECT ve.id, row_number() OVER (ORDER BY ve.created_at) AS rn
  FROM vehicles ve WHERE ve.company_id = c.id
) vh ON vh.rn = v.d
WHERE lower(c.name)='onecomit'
  AND NOT EXISTS (
    SELECT 1 FROM vehicle_checks vc
    WHERE vc.company_id = c.id AND vc.vehicle_id = vh.id AND vc.observations = v.obs
  );

-- Summary
SELECT 'incidents='||COUNT(*) FROM incidents WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
UNION ALL SELECT 'stock_levels='||COUNT(*) FROM stock_levels WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
UNION ALL SELECT 'stock_movements='||COUNT(*) FROM stock_movements WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
UNION ALL SELECT 'expenses='||COUNT(*) FROM expenses WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
UNION ALL SELECT 'cash_box='||COUNT(*) FROM cash_box_entries WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
UNION ALL SELECT 'notifications='||COUNT(*) FROM notifications WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
UNION ALL SELECT 'attendance='||COUNT(*) FROM attendance WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
UNION ALL SELECT 'leave_requests='||COUNT(*) FROM leave_requests WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit')
UNION ALL SELECT 'vehicle_checks='||COUNT(*) FROM vehicle_checks WHERE company_id=(SELECT id FROM companies WHERE lower(name)='onecomit');
