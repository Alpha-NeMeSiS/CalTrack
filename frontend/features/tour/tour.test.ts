import { describe, expect, it } from 'vitest';
import { placeBubble, TOUR_STEPS } from './tour';

const mobile = { width: 412, height: 839 };
const desktop = { width: 1280, height: 720 };

describe('étapes de la visite', () => {
  it('suit l’ordre de la spec, avec ses textes', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual(['calories', 'add', 'water', 'weight', 'nav']);
    expect(TOUR_STEPS[0].title).toBe('Votre journée en un coup d’œil');
    expect(TOUR_STEPS[4].title).toBe('Aller plus loin');
    expect(TOUR_STEPS[4].body).toContain('menu de votre avatar');
  });
});

describe('placeBubble', () => {
  it('place la bulle sous la cible quand la place suffit (mobile : pleine largeur)', () => {
    const target = { top: 120, left: 40, width: 200, height: 200 };
    expect(placeBubble(target, 220, mobile, { bottomInset: 88 })).toEqual({ top: 120 + 200 + 6 + 12, left: 16, width: 380 });
  });

  it('la place au-dessus quand la place manque dessous', () => {
    const target = { top: 600, left: 16, width: 380, height: 120 };
    expect(placeBubble(target, 220, mobile, { bottomInset: 88 })).toEqual({ bottom: 839 - 600 + 6 + 12, left: 16, width: 380 });
  });

  it('la pose en bas de l’écran quand ni dessus ni dessous ne suffisent', () => {
    const target = { top: 100, left: 16, width: 380, height: 640 };
    expect(placeBubble(target, 220, mobile, { bottomInset: 88 })).toEqual({ bottom: 88, left: 16, width: 380 });
  });

  it('ordinateur : 360 px alignés sur la cible et gardés dans l’écran', () => {
    const left = placeBubble({ top: 120, left: 300, width: 200, height: 100 }, 220, desktop, { bottomInset: 16 });
    expect(left).toMatchObject({ left: 300, width: 360 });
    const right = placeBubble({ top: 120, left: 1100, width: 150, height: 100 }, 220, desktop, { bottomInset: 16 });
    expect(right.left).toBe(1280 - 16 - 360);
  });
});
