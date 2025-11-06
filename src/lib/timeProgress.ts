export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function weeksBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return ms / (7 * 24 * 60 * 60 * 1000);
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + Math.round(weeks * 7));
  return d;
}

export function computeTimeProgress(start: Date, end: Date, now: Date) {
  try {
    const startMs = start.getTime();
    const nowMs = now.getTime();
    const endMs = end.getTime();
    
    // Calculer les semaines totales entre début et fin
    const totalWeeks = Math.max(1, weeksBetween(start, end));
    
    // Calculer les semaines exactes écoulées depuis le début
    const elapsedWeeks = Math.max(0, weeksBetween(start, now));
    
    // Le pourcentage est basé sur le nombre de semaines écoulées
    const percent = (elapsedWeeks / totalWeeks) * 100;
    
    // Ne jamais retourner plus de semaines écoulées que le total
    const cappedElapsedWeeks = Math.min(elapsedWeeks, totalWeeks);
    
    return {
      percent: clamp(percent),
      elapsedWeeks: cappedElapsedWeeks,
      totalWeeks,
      // Ajouter les jours écoulés dans la semaine courante
      elapsedDays: Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000))
    };
  } catch (err) {
    console.warn('Invalid dates in computeTimeProgress', err);
    return { 
      percent: 0, 
      elapsedWeeks: 0, 
      totalWeeks: 1,
      elapsedDays: 0 
    };
  }
}

export function humanizeRemaining(now: Date, end: Date): string {
  try {
    const ms = Math.max(0, end.getTime() - now.getTime());
    if (ms === 0) return '0 jour';
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days < 7) return `${days} jour${days > 1 ? 's' : ''}`;
    const weeks = Math.round(days / 7);
    return `${weeks} semaine${weeks > 1 ? 's' : ''}`;
  } catch (err) {
    console.warn('Invalid dates in humanizeRemaining', err);
    return '—';
  }
}

// Return number of days remaining (ceiling), never negative
export function remainingDays(now: Date, end: Date): number {
  try {
    const ms = Math.max(0, end.getTime() - now.getTime());
    return Math.ceil(ms / (24 * 60 * 60 * 1000));
  } catch (err) {
    console.warn('Invalid dates in remainingDays', err);
    return 0;
  }
}

// Compute remaining days based on start/date progression. If start is provided,
// remainingDays = max(0, totalDays - daysPassed) where totalDays = ceil((end-start)/1day)
// and daysPassed = floor((now-start)/1day). This aligns remaining days with whole
// days passed since start.
export function remainingDaysFromStart(start: Date | undefined, now: Date, end: Date): number {
  try {
    if (!start) return remainingDays(now, end);
    const msPerDay = 24 * 60 * 60 * 1000;
    const totalDays = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / msPerDay));
    const daysPassed = Math.max(0, Math.floor((now.getTime() - start.getTime()) / msPerDay));
    return Math.max(0, totalDays - daysPassed);
  } catch (err) {
    console.warn('Invalid dates in remainingDaysFromStart', err);
    return remainingDays(now, end);
  }
}

export function humanizeRemainingDays(now: Date, end: Date, start?: Date): string {
  const days = start ? remainingDaysFromStart(start, now, end) : remainingDays(now, end);
  return `${days} jour${days > 1 ? 's' : ''}`;
}

export function formatDateFR(d: Date): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch (err) {
    return d.toISOString().split('T')[0];
  }
}
