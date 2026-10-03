-- =============================================================
-- VECTRACOM — Migration 013 : backfill type_tache normalisé.
-- Aligne les valeurs historiques avec normalizeTask() (import).
-- « Survey+Installation » et variantes = installation (production).
-- =============================================================

UPDATE missions
   SET type_tache = 'INSTALLATION'
 WHERE lower(trim(type_tache)) IN (
   'survey + installation',
   'survey+installation',
   'installation',
   'install',
   'finalisation'
 );

-- Valeurs déjà normalisées (SAV, SURVEY, DENSIFICATION, INFRA…) : inchangées.
