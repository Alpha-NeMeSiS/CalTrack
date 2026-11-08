#!/usr/bin/env bash
# Tests de la base de données : rejoue toutes les migrations sur une base
# vierge, puis exécute les tests SQL de supabase/tests/.
#
# Connexion via les variables standard de Postgres (PGHOST, PGPORT, PGUSER,
# PGPASSWORD). Le rôle doit pouvoir créer une base et des rôles.
#   npm run test:db
#   PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db
#
# La base de test (TEST_DB, « caltrack_test » par défaut) est recréée à
# chaque lancement : n'utilisez jamais le nom d'une base qui contient des données.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TEST_DB:-caltrack_test}"
MIGRATIONS="$ROOT/supabase/migrations"
TESTS="$ROOT/supabase/tests"

case "$DB" in
  *test*) ;;
  *) echo "Refus : le nom de la base de test doit contenir « test » (reçu : $DB)." >&2; exit 2 ;;
esac

PSQL=(psql -X -q -v ON_ERROR_STOP=1 --no-psqlrc)

echo "== Base de test : $DB"
"${PSQL[@]}" -d postgres -c "SET client_min_messages = warning" -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" >/dev/null
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DB\"" >/dev/null

run_file() {
  local label="$1" file="$2"
  if ! output=$("${PSQL[@]}" -d "$DB" -f "$file" 2>&1); then
    echo "ÉCHEC  $label"
    echo "$output" | sed 's/^/    /'
    exit 1
  fi
}

run_file "environnement Supabase" "$TESTS/setup.sql"

echo "== Migrations"
count=0
for file in "$MIGRATIONS"/*.sql; do
  run_file "$(basename "$file")" "$file"
  count=$((count + 1))
done
echo "   $count migrations appliquées"

run_file "outils de test" "$TESTS/helpers.sql"

echo "== Tests"
failures=0
for file in "$TESTS"/[0-9]*.sql; do
  name="$(basename "$file" .sql)"
  # Chaque fichier dans une transaction annulée : les tests sont indépendants
  # -o /dev/null : seuls les messages (NOTICE) et les erreurs sont gardés
  if output=$( { echo "BEGIN;"; cat "$file"; echo "ROLLBACK;"; } | "${PSQL[@]}" -o /dev/null -d "$DB" 2>&1); then
    checks=$(grep -c "NOTICE:  ok - " <<<"$output" || true)
    echo "   ok      $name ($checks vérifications)"
  else
    failures=$((failures + 1))
    echo "   ÉCHEC   $name"
    echo "$output" | grep -v "NOTICE:  ok - " | sed 's/^/      /'
  fi
done

if [ "$failures" -gt 0 ]; then
  echo "== $failures fichier(s) de test en échec"
  exit 1
fi
echo "== Tous les tests de la base sont passés"
