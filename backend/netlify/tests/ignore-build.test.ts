// @vitest-environment node
// Règle « ignore » de Netlify (backend/netlify/ignore-build.sh) : sur l'offre
// gratuite, chaque déploiement en production coûte des crédits. La production
// ne se construit que si la version de package.json change ; les
// prévisualisations de PR (gratuites) se construisent toujours.
// Code de sortie Netlify : 0 = ne pas construire, 1 = construire.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve(__dirname, '../ignore-build.sh');
const SKIP = 0;
const BUILD = 1;

let repo: string;

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

/** Commit qui fixe la version de package.json, renvoie son SHA */
function commitVersion(version: string, message = `version ${version}`) {
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ name: 'caltrack', version }, null, 2));
  git('add', 'package.json');
  git('commit', '-q', '--allow-empty', '-m', message);
  return git('rev-parse', 'HEAD');
}

/** Commit sans changement de version (code, docs…), renvoie son SHA */
function commitCode(message = 'refactor: rangement') {
  writeFileSync(join(repo, `file-${Date.now()}-${Math.random()}.txt`), 'x');
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
}

function run(env: Record<string, string | undefined>) {
  const result = spawnSync('bash', [SCRIPT], {
    cwd: repo,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
  });
  return result.status;
}

function setupRepo() {
  repo = mkdtempSync(join(tmpdir(), 'caltrack-ignore-'));
  git('init', '-q');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
}

afterEach(() => {
  if (repo) rmSync(repo, { recursive: true, force: true });
});

describe('règle ignore de Netlify', () => {
  it('construit toujours les prévisualisations de PR (gratuites)', () => {
    setupRepo();
    const previous = commitVersion('2.2.0');
    const current = commitCode();
    expect(run({ CONTEXT: 'deploy-preview', CACHED_COMMIT_REF: previous, COMMIT_REF: current })).toBe(BUILD);
  });

  it('ignore la production si la version ne change pas', () => {
    setupRepo();
    const previous = commitVersion('2.2.0');
    const current = commitCode();
    expect(run({ CONTEXT: 'production', CACHED_COMMIT_REF: previous, COMMIT_REF: current })).toBe(SKIP);
  });

  it('déploie la production quand la version change', () => {
    setupRepo();
    const previous = commitVersion('2.2.0');
    commitCode();
    const current = commitVersion('2.2.1');
    expect(run({ CONTEXT: 'production', CACHED_COMMIT_REF: previous, COMMIT_REF: current })).toBe(BUILD);
  });

  it('déploie la production si le message du dernier commit contient [deploy]', () => {
    setupRepo();
    const previous = commitVersion('2.2.0');
    const current = commitCode('Merge pull request #60\n\nCorrectif urgent [deploy]');
    expect(run({ CONTEXT: 'production', CACHED_COMMIT_REF: previous, COMMIT_REF: current })).toBe(BUILD);
  });

  it('déploie la production si le dernier déploiement est inconnu ou absent du dépôt', () => {
    setupRepo();
    const current = commitVersion('2.2.0');
    expect(run({ CONTEXT: 'production', COMMIT_REF: current })).toBe(BUILD);
    expect(run({ CONTEXT: 'production', CACHED_COMMIT_REF: 'deadbeef', COMMIT_REF: current })).toBe(BUILD);
  });

  it('redéploie la production lancée à la main sur le même commit (« Trigger deploy »)', () => {
    setupRepo();
    const current = commitVersion('2.2.0');
    expect(run({ CONTEXT: 'production', CACHED_COMMIT_REF: current, COMMIT_REF: current })).toBe(BUILD);
  });
});
