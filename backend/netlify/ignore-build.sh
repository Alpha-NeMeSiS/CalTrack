#!/usr/bin/env bash
# Règle « ignore » de Netlify (netlify.toml → [build] ignore).
#
# Sur l'offre gratuite de Netlify, chaque déploiement en production coûte des
# crédits (300 par mois). On ne déploie donc la production qu'à chaque nouvelle
# version : quand la « version » de package.json change depuis le dernier
# déploiement. Les prévisualisations de PR, gratuites, se construisent toujours.
#
# Pour forcer un déploiement sans changer de version : mettre « [deploy] » dans
# le titre de la PR (il se retrouve dans le message du commit de fusion), ou
# relancer le dernier déploiement depuis Netlify (« Trigger deploy »).
#
# Code de sortie attendu par Netlify : 0 = ne pas construire, 1 = construire.
set -u

build() {
  echo "Netlify : $1, construction."
  exit 1
}

skip() {
  echo "Netlify : $1, déploiement en production ignoré (crédits économisés)."
  exit 0
}

[ "${CONTEXT:-}" = "production" ] || build "contexte ${CONTEXT:-inconnu}"

if git log -1 --pretty=%B 2>/dev/null | grep -qi '\[deploy\]'; then
  build "« [deploy] » demandé dans le dernier commit"
fi

previous="${CACHED_COMMIT_REF:-}"
current="${COMMIT_REF:-HEAD}"

[ -n "$previous" ] || build "aucun déploiement précédent connu"
[ "$previous" != "$current" ] || build "redéploiement du même commit"
git cat-file -e "${previous}^{commit}" 2>/dev/null || build "dernier déploiement absent de l'historique"

version_at() {
  git show "$1:package.json" 2>/dev/null \
    | node -e 'let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => { try { console.log(JSON.parse(s).version ?? ""); } catch { console.log(""); } });'
}

old_version="$(version_at "$previous")"
new_version="$(version_at "$current")"

[ -n "$new_version" ] || build "version introuvable"
[ "$old_version" = "$new_version" ] || build "nouvelle version ${old_version:-?} → $new_version"
skip "version $new_version inchangée"
