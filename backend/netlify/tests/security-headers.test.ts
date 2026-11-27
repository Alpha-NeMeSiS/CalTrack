// En-têtes de sécurité de netlify.toml (audit A-07).
//
// Le vrai piège ici est l'empreinte sha256 autorisée dans `script-src` : elle
// correspond au <script> en ligne de index.html (le thème appliqué avant
// l'affichage). Si quelqu'un modifie ce script sans recalculer l'empreinte, le
// navigateur le bloque silencieusement et le flash clair revient en mode
// sombre. Ce test fait échouer la CI dans ce cas.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../../..');
const netlifyToml = readFileSync(join(root, 'netlify.toml'), 'utf8');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

const csp = netlifyToml.match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? '';

/** Directive d'une CSP, sous forme de liste de valeurs. */
function directive(name: string): string[] {
  const found = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ? found.split(/\s+/).slice(1) : [];
}

describe('en-têtes de sécurité', () => {
  it('définit une Content-Security-Policy', () => {
    expect(csp).not.toBe('');
  });

  it("autorise exactement l'empreinte du script en ligne de index.html", () => {
    const inlineScripts = [...indexHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inlineScripts.length).toBe(1); // un seul script en ligne attendu

    const expected = `'sha256-${createHash('sha256').update(inlineScripts[0], 'utf8').digest('base64')}'`;
    expect(directive('script-src')).toContain(expected);
  });

  it("n'autorise pas 'unsafe-inline' ni 'unsafe-eval' pour les scripts", () => {
    const scriptSrc = directive('script-src');
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    // WebAssembly du scanner de code-barres (ZXing) : nécessaire
    expect(scriptSrc).toContain("'wasm-unsafe-eval'");
  });

  it('autorise les deux domaines des polices Google', () => {
    // La feuille de style vient de fonts.googleapis.com et référence les
    // fichiers de police sur fonts.gstatic.com : les deux sont nécessaires.
    expect(indexHtml).toContain('https://fonts.googleapis.com');
    expect(directive('style-src')).toContain('https://fonts.googleapis.com');
    expect(directive('font-src')).toContain('https://fonts.gstatic.com');
  });

  it('autorise Supabase et les images Open Food Facts', () => {
    expect(directive('connect-src')).toContain('https://*.supabase.co');
    expect(directive('connect-src')).toContain('wss://*.supabase.co');
    expect(directive('img-src')).toContain('https://images.openfoodfacts.org');
    // Photo de profil recadrée dans un canvas puis envoyée : URL blob:
    expect(directive('img-src')).toContain('blob:');
  });

  it('interdit l’affichage dans une iframe', () => {
    expect(directive('frame-ancestors')).toContain("'none'");
    expect(netlifyToml).toContain('X-Frame-Options = "DENY"');
  });

  it('pose les autres en-têtes attendus', () => {
    expect(netlifyToml).toContain('X-Content-Type-Options = "nosniff"');
    expect(netlifyToml).toContain('Referrer-Policy = "strict-origin-when-cross-origin"');
    expect(netlifyToml).toContain('Strict-Transport-Security');
    // Caméra autorisée (scanner), micro et géolocalisation refusés
    expect(netlifyToml).toMatch(/Permissions-Policy = "camera=\(self\), microphone=\(\)/);
  });
});
