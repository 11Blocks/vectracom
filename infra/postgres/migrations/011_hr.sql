-- 011 — RH : trace de l'embauche d'un candidat (fiche employé / technicien créées).
-- Idempotent.

ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS hired_at timestamptz;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS hired_employee_id uuid;
ALTER TABLE recruitment_candidates ADD COLUMN IF NOT EXISTS hired_technician_id uuid;

-- Statut « en congé » dérivé des congés approuvés du jour (plus d'état figé).
UPDATE employees e SET status = 'actif'
 WHERE e.status = 'en_conge'
   AND NOT EXISTS (
     SELECT 1 FROM leave_requests l
      WHERE l.employee_id = e.id AND l.status = 'approuve'
        AND CURRENT_DATE BETWEEN l.start_date AND l.end_date);
