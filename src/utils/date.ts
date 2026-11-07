// Utilitaires de dates "calendaires" (format YYYY-MM-DD) basés sur le fuseau LOCAL.
//
// ⚠️ Ne pas utiliser `date.toISOString().split('T')[0]` : toISOString() renvoie la
// date en UTC. En France (UTC+1 / UTC+2), un repas saisi entre minuit et 1-2h du
// matin serait alors enregistré à la date de la veille.
// De même, `new Date('2025-01-15')` est interprété en UTC (minuit UTC), ce qui
// peut décaler le jour affiché selon le fuseau : utiliser parseLocalDate().

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number): string => String(value).padStart(2, '0');

/** Formate une date en YYYY-MM-DD selon le fuseau local. */
export function toLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date du jour (fuseau local) au format YYYY-MM-DD. */
export function getTodayDate(): string {
  return toLocalDateString(new Date());
}

/** Vérifie qu'une chaîne est au format YYYY-MM-DD. */
export function isDateOnlyString(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value);
}

/**
 * Convertit une chaîne YYYY-MM-DD en Date à minuit LOCAL.
 * Les autres formats (timestamps ISO complets) sont délégués à `new Date()`.
 */
export function parseLocalDate(value: string): Date {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    return new Date(value);
  }
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

/** Ajoute (ou retire si négatif) un nombre de jours à une date YYYY-MM-DD. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

/** Convertit un timestamp (ex: created_at) en date locale YYYY-MM-DD. */
export function timestampToLocalDateString(timestamp: string): string {
  return toLocalDateString(new Date(timestamp));
}
