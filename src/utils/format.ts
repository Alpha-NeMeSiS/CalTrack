// Formatage des nombres affichés, à la française : virgule décimale, espace
// fine entre les milliers, vrai signe moins (−). À utiliser à la place de
// toFixed(), qui affiche « 1.5 ».
const LOCALE = 'fr-FR';

/** Nombre avec exactement `digits` décimales : 1,5 ; 2 000 */
export const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Nombre avec au plus `maxDigits` décimales : 80 ; 80,3 */
export const formatDecimal = (value: number, maxDigits = 1) =>
  value.toLocaleString(LOCALE, { maximumFractionDigits: maxDigits });

/** Écart signé : +1,5 ; −3,0 ; 0 (pas de signe si la valeur arrondie est nulle) */
export const formatSigned = (value: number, digits = 0) => {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(rounded), digits)}`;
};

/** Masse en kilogrammes : 80,0 kg */
export const formatKg = (value: number, digits = 1) => `${formatNumber(value, digits)} kg`;

/** Pourcentage déjà multiplié par 100 : 50 % */
export const formatPercent = (value: number, digits = 0) => `${formatNumber(value, digits)} %`;
