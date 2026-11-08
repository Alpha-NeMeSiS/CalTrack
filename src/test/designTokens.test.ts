// Garde-fou du design system : le code utilise les rôles de couleur
// (theme.palette.js, docs/design-system.md), jamais une teinte brute.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// Teintes brutes interdites dans les classes (l'orange reste une couleur de données)
const RAW_COLOR = /(?<![\w-])(?:[a-z0-9-]+:)*(?:bg|text|border|ring|divide|fill|stroke|from|to|via|placeholder|outline|shadow)-(?:white|gray|slate|zinc|neutral|stone|blue|sky|indigo|red|rose|green|emerald|lime|amber|yellow|teal|cyan|purple|violet|pink)(?:-\d{2,3})?(?:\/\d+)?(?![\w-])/g;
// Anciens noms du thème
const OLD_NAMES = /\b(?:kaizen|shonen|btn-kaizen|card-kaizen|badge-energy)\b/g;

describe('design system', () => {
  const files = sourceFiles(SRC);

  it('aucune teinte brute dans les classes : uniquement des rôles', () => {
    const offenders = files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(RAW_COLOR)].map((m) => `${relative(SRC, file)} : ${m[0]}`)
    );
    expect(offenders).toEqual([]);
  });

  it('plus aucun ancien nom de thème (kaizen, shonen…)', () => {
    const offenders = files.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(OLD_NAMES)].map((m) => `${relative(SRC, file)} : ${m[0]}`)
    );
    expect(offenders).toEqual([]);
  });
});
