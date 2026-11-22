import { describe, expect, it } from 'vitest';
import { compareVersions, isNewerVersion, unseenReleases } from './releases';
import { RELEASES, ReleaseNote } from '../data/releases';
import { APP_VERSION } from './appInfo';

const note = (version: string): ReleaseNote => ({ version, date: '2026-12-03', items: ['Un point'] });
const sample = [note('2.1.0'), note('2.0.1'), note('2.0.0')];

describe('compareVersions', () => {
  it('compare chaque partie comme un nombre', () => {
    expect(compareVersions('2.0.10', '2.0.9')).toBeGreaterThan(0);
    expect(compareVersions('2.1.0', '2.0.10')).toBeGreaterThan(0);
    expect(compareVersions('2.1.0', '2.1.0')).toBe(0);
    expect(compareVersions('1.9.9', '2.0.0')).toBeLessThan(0);
  });

  it('considère une version mal formée comme 0.0.0', () => {
    expect(compareVersions('abc', '0.0.0')).toBe(0);
    expect(compareVersions('2.0.0', 'abc')).toBeGreaterThan(0);
  });
});

describe('unseenReleases', () => {
  it('renvoie les versions plus récentes que la dernière vue', () => {
    expect(unseenReleases(sample, '2.0.0').map((r) => r.version)).toEqual(['2.1.0', '2.0.1']);
    expect(unseenReleases(sample, '2.1.0')).toEqual([]);
  });

  it('sans version vue (ou invalide), renvoie seulement la dernière', () => {
    expect(unseenReleases(sample, null).map((r) => r.version)).toEqual(['2.1.0']);
    expect(unseenReleases(sample, 'abc').map((r) => r.version)).toEqual(['2.1.0']);
  });
});

describe('isNewerVersion', () => {
  it('vrai si la version vue est vide, invalide ou plus ancienne', () => {
    expect(isNewerVersion('2.1.0', '2.0.0')).toBe(true);
    expect(isNewerVersion('2.1.0', '2.1.0')).toBe(false);
    expect(isNewerVersion('2.1.0', null)).toBe(true);
    expect(isNewerVersion('2.1.0', 'abc')).toBe(true);
  });
});

describe('RELEASES (garde-fous)', () => {
  it('a des notes pour la version de package.json, en tête de liste', () => {
    expect(RELEASES[0].version).toBe(APP_VERSION);
  });

  it('est triée de la plus récente à la plus ancienne, sans doublon', () => {
    const versions = RELEASES.map((r) => r.version);
    expect(new Set(versions).size).toBe(versions.length);
    for (let i = 1; i < RELEASES.length; i++) {
      expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBeGreaterThan(0);
    }
  });

  it('a des dates ISO et 1 à 5 points non vides par version', () => {
    for (const release of RELEASES) {
      expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(release.items.length).toBeGreaterThanOrEqual(1);
      expect(release.items.length).toBeLessThanOrEqual(5);
      for (const item of release.items) expect(item.trim()).not.toBe('');
    }
  });

  it('reprend les textes de la spec pour 2.1.0 et 2.0.0', () => {
    const byVersion = Object.fromEntries(RELEASES.map((r) => [r.version, r]));
    expect(byVersion['2.1.0'].items).toEqual([
      'Visite guidée : 5 bulles pour découvrir le journal, à relancer quand vous voulez depuis le Guide.',
      'Nouvelle page « Guide » : le fonctionnement de l’app, pas à pas.',
      'Cette fenêtre vous présente maintenant chaque mise à jour.',
    ]);
    expect(byVersion['2.0.0'].date).toBe('2026-11-22');
    expect(byVersion['2.0.0'].items).toEqual([
      'Nouveau look : couleur verte, nouvelle police et thème sombre.',
      'Scanner de code-barres pour retrouver un produit en un instant.',
      'Favoris, récents, « Mes aliments » et recettes maison en parts.',
      'Suivi de l’eau, des pesées et de la composition corporelle.',
      'Ajout de plusieurs aliments à la suite, rappels et application installable.',
    ]);
  });
});
