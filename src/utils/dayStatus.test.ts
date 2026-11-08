import { describe, expect, it } from 'vitest';
import { DAY_STATUS_LABELS, getBarColorClass, getCalorieAxisTicks, getDayStatus } from './dayStatus';

describe('getDayStatus', () => {
  it("une journée passée sans saisie est « non renseignée », pas un échec (régression)", () => {
    expect(getDayStatus({ status: 'under', entryCount: 0, isToday: false })).toBe('not_logged');
  });

  it("la journée en cours n'est pas jugée tant qu'elle est sous l'objectif (régression)", () => {
    expect(getDayStatus({ status: 'under', entryCount: 0, isToday: true })).toBe('in_progress');
    expect(getDayStatus({ status: 'under', entryCount: 3, isToday: true })).toBe('in_progress');
  });

  it("aujourd'hui, l'objectif atteint ou dépassé reste signalé", () => {
    expect(getDayStatus({ status: 'ok', entryCount: 4, isToday: true })).toBe('ok');
    expect(getDayStatus({ status: 'over', entryCount: 4, isToday: true })).toBe('over');
  });

  it('garde le statut calculé pour les journées passées renseignées', () => {
    expect(getDayStatus({ status: 'under', entryCount: 2, isToday: false })).toBe('under');
    expect(getDayStatus({ status: 'ok', entryCount: 2, isToday: false })).toBe('ok');
    expect(getDayStatus({ status: 'over', entryCount: 2, isToday: false })).toBe('over');
  });

  it('a un libellé pour chaque statut', () => {
    expect(DAY_STATUS_LABELS).toEqual({
      not_logged: 'Non renseigné',
      in_progress: 'En cours',
      under: 'En dessous',
      ok: "À l'objectif",
      over: 'Au-dessus',
    });
  });
});

describe('getBarColorClass', () => {
  it('utilise des couleurs neutres pour « non renseigné » et « en cours »', () => {
    expect(getBarColorClass('not_logged', 0, 2000)).toBe('bg-surface-strong');
    expect(getBarColorClass('in_progress', 800, 2000)).toBe('bg-info-400');
  });

  it("nuance selon l'écart à l'objectif", () => {
    expect(getBarColorClass('ok', 2000, 2000)).toBe('bg-success-500');
    expect(getBarColorClass('under', 1700, 2000)).toBe('bg-orange-400');
    expect(getBarColorClass('under', 1000, 2000)).toBe('bg-orange-600');
    expect(getBarColorClass('over', 2200, 2000)).toBe('bg-danger-400');
    expect(getBarColorClass('over', 2800, 2000)).toBe('bg-danger-600');
  });
});

describe('getCalorieAxisTicks', () => {
  it('produit des graduations rondes couvrant la valeur maximale', () => {
    expect(getCalorieAxisTicks(2385)).toEqual([0, 750, 1500, 2250, 3000]);
    expect(getCalorieAxisTicks(2150)).toEqual([0, 750, 1500, 2250, 3000]);
    expect(getCalorieAxisTicks(1900)).toEqual([0, 500, 1000, 1500, 2000]);
  });

  it('garde une échelle minimale sans données', () => {
    expect(getCalorieAxisTicks(0)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(getCalorieAxisTicks(Number.NaN)).toEqual([0, 500, 1000, 1500, 2000]);
  });
});
