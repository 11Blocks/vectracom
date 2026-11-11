#!/usr/bin/env bash
# VECTRACOM — applique TOUTES les migrations SQL, dans l'ordre, en mode strict.
#
# Usage : ./scripts/apply-migrations.sh [conteneur] [base]
#   conteneur : conteneur PostgreSQL (défaut : vectracom-postgres)
#   base      : base cible           (défaut : vectracom)
#   DB_USER   : variable d'environnement, rôle PostgreSQL (défaut : vectracom)
#
# Mode strict :
#   - chaque fichier est exécuté dans UNE transaction (psql -1) avec ON_ERROR_STOP=1 :
#     au moindre échec, le fichier est entièrement annulé et le script s'arrête ;
#   - les migrations sont découvertes automatiquement (infra/postgres/migrations/NNN_*.sql) ;
#     la numérotation doit être continue (001, 002, …) et sans doublon.
#
# Toutes les migrations sont idempotentes : le script peut être relancé sur une
# base déjà à jour.
# Base NEUVE : infra/postgres/docker-init/01-schema.sql est le schéma de référence
# (export de la structure de la prod, MIG-3) ; le conteneur l'exécute au premier
# démarrage. Les migrations 001→021 s'appliquent ensuite par-dessus sans erreur
# et sans changer tables ni colonnes ; 001/002 ajoutent seulement des index absents
# de la prod (MIG-4). Sans ce schéma, 001→021 seules ne reproduisent pas les
# colonnes de la prod (voir CLAUDE.md §4, « Dérive de schéma »).
# ⚠️ 013 normalise des données de missions (type_tache) : ne pas lancer sur une
# base de dev sans accord. Jamais sur le VPS sans accord.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${1:-vectracom-postgres}"
DB="${2:-vectracom}"
DB_USER="${DB_USER:-vectracom}"
MIG_DIR="$ROOT/infra/postgres/migrations"

shopt -s nullglob
files=("$MIG_DIR"/[0-9][0-9][0-9]_*.sql)
shopt -u nullglob
if [ "${#files[@]}" -eq 0 ]; then
  echo "!! aucune migration trouvée dans $MIG_DIR" >&2
  exit 1
fi

# Numérotation continue et sans doublon (le glob est déjà trié).
expected=1
for f in "${files[@]}"; do
  num=$((10#$(basename "$f" | cut -c1-3)))
  if [ "$num" -lt "$expected" ]; then
    echo "!! numéro en double : $(basename "$f") (le numéro $(printf '%03d' "$num") est déjà utilisé)" >&2
    exit 1
  elif [ "$num" -gt "$expected" ]; then
    echo "!! numérotation incohérente : $(basename "$f") (attendu $(printf '%03d' "$expected"), migration manquante)" >&2
    exit 1
  fi
  expected=$((expected + 1))
done

run_sql() {
  local file="$1" out
  if [ ! -s "$file" ]; then
    echo "!! fichier vide : $(basename "$file")" >&2
    return 1
  fi
  if ! out=$(docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB" -1 -q -v ON_ERROR_STOP=1 < "$file" 2>&1); then
    echo "!! ÉCHEC : $(basename "$file") — transaction annulée, arrêt." >&2
    printf '%s\n' "$out" | grep -v '^NOTICE:' | head -20 >&2
    return 1
  fi
}

echo "=== Migrations → $CONTAINER / base $DB (${#files[@]} fichiers, mode strict)"

# Extensions d'abord (uuid-ossp, pg_trgm, unaccent).
if [ -f "$ROOT/infra/postgres/init.sql" ]; then
  echo "  init.sql"
  run_sql "$ROOT/infra/postgres/init.sql"
fi

for f in "${files[@]}"; do
  echo "  $(basename "$f")"
  run_sql "$f"
done

echo "=== ${#files[@]} migrations appliquées sans erreur"
