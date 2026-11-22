// Comparaison de versions (MAJEUR.MINEUR.CORRECTIF) et notes non encore vues.
import type { ReleaseNote } from './releaseNotes';

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

/** Parties numériques d'une version ; une version mal formée vaut 0.0.0 */
function parts(version: string | null | undefined): [number, number, number] {
  const match = VERSION_PATTERN.exec(version?.trim() ?? '');
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
}

const isValid = (version: string | null | undefined) => VERSION_PATTERN.test(version?.trim() ?? '');

/** > 0 si a est plus récente que b, < 0 si plus ancienne, 0 si égales */
export function compareVersions(a: string, b: string): number {
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

/** Vrai si la version actuelle n'a pas encore été vue (rien de vu, valeur invalide ou plus ancienne) */
export function isNewerVersion(current: string, lastSeen: string | null): boolean {
  if (!isValid(lastSeen)) return true;
  return compareVersions(current, lastSeen as string) > 0;
}

/**
 * Notes à montrer : les versions plus récentes que la dernière vue.
 * Sans version vue (ou valeur invalide), seulement la plus récente.
 */
export function unseenReleases(releases: readonly ReleaseNote[], lastSeen: string | null): ReleaseNote[] {
  if (!isValid(lastSeen)) return releases.slice(0, 1);
  return releases.filter((release) => compareVersions(release.version, lastSeen as string) > 0);
}
