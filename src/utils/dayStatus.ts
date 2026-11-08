// Statut d'affichage d'une journée dans le suivi (fonctions pures, testables).
//
// Le statut calculé par calculateDailySummary (under / ok / over) ne suffit pas :
// - une journée SANS AUCUNE saisie n'est pas « très en dessous de l'objectif »,
//   elle n'est simplement pas renseignée ;
// - la journée EN COURS n'est pas finie : être sous l'objectif à midi est normal.
// Auparavant, ces deux cas s'affichaient en orange foncé, comme des échecs.

export type CalorieStatus = 'under' | 'ok' | 'over';
export type DayStatus = 'not_logged' | 'in_progress' | CalorieStatus;

export function getDayStatus({
  status,
  entryCount,
  isToday,
}: {
  status: CalorieStatus;
  entryCount: number;
  isToday: boolean;
}): DayStatus {
  if (entryCount === 0) {
    return isToday ? 'in_progress' : 'not_logged';
  }
  // Aujourd'hui, seul un dépassement (ou l'objectif atteint) est déjà significatif
  if (isToday && status === 'under') {
    return 'in_progress';
  }
  return status;
}

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  not_logged: 'Non renseigné',
  in_progress: 'En cours',
  under: 'En dessous',
  ok: "À l'objectif",
  over: 'Au-dessus',
};

/** Couleur de barre du graphique (nuance selon l'écart à l'objectif). */
export function getBarColorClass(dayStatus: DayStatus, consumed: number, target: number): string {
  if (dayStatus === 'not_logged') return 'bg-surface-strong';
  if (dayStatus === 'in_progress') return 'bg-info-400';
  if (!target || target <= 0) return 'bg-line-strong';

  const percentage = (consumed / target) * 100;
  if (dayStatus === 'ok') return 'bg-success-500';
  if (dayStatus === 'under') return percentage < 75 ? 'bg-orange-600' : 'bg-orange-400';
  return percentage > 125 ? 'bg-danger-600' : 'bg-danger-400';
}

/**
 * Graduations « rondes » de l'axe des calories : intervalle multiple de 250 kcal
 * (500 minimum), la dernière graduation couvrant la valeur maximale.
 * Ex. : max 2385 → 0, 750, 1500, 2250, 3000.
 */
export function getCalorieAxisTicks(maxValue: number, tickCount = 4): number[] {
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
  const interval = Math.max(500, Math.ceil(safeMax / tickCount / 250) * 250);
  return Array.from({ length: tickCount + 1 }, (_, i) => i * interval);
}
