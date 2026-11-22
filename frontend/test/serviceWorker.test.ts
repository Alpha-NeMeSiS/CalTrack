// Notifications de rappel : Android n'affiche du petit badge que sa forme (canal
// alpha). Il faut une icône dédiée, blanche sur fond transparent, pas l'icône pleine.
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

/** Part des pixels transparents d'un PNG RVBA 8 bits (sans entrelacement) */
function transparentShare(path: string): number {
  const png = readFileSync(path);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  expect(png[25]).toBe(6); // RVBA
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') chunks.push(png.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * 4;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    const prev = rows[y - 1];
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? line[x - 4] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= 4 ? prev[x - 4] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const add = [0, a, b, (a + b) >> 1, paeth][filter];
      line[x] = (line[x] + add) & 0xff;
    }
    rows.push(line);
  }
  let transparent = 0;
  for (const line of rows) for (let x = 3; x < stride; x += 4) if (line[x] < 10) transparent++;
  return transparent / (width * height);
}

describe('service worker : notifications', () => {
  const sw = readFileSync('public/sw.js', 'utf8');

  it('utilise une icône de badge dédiée', () => {
    const badge = /badge:\s*'([^']+)'/.exec(sw)?.[1];
    expect(badge).toBe('/icons/badge-96.png');
    expect(existsSync(`public${badge}`)).toBe(true);
  });

  it('l’icône de badge est une forme sur fond transparent', () => {
    const share = transparentShare('public/icons/badge-96.png');
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.95);
  });
});
