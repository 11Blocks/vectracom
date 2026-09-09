-- VECTRACOM — initialisation PostgreSQL
-- Exécuté automatiquement au premier démarrage du conteneur.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
