// Codes-barres des produits (GTIN : EAN-8, UPC-A, EAN-13, GTIN-14).

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/**
 * Vérifie la longueur et la clé de contrôle (dernier chiffre) d'un code GTIN.
 * Écarte les lectures erronées de la caméra et les fautes de frappe.
 */
export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code) || !GTIN_LENGTHS.has(code.length)) return false;
  const digits = code.split('').map(Number);
  const checkDigit = digits.pop()!;
  // En partant de la droite (hors clé), les chiffres sont pondérés 3, 1, 3, 1…
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === checkDigit;
}

/** Retire les espaces et tirets d'un code saisi à la main. */
export function cleanBarcodeInput(value: string): string {
  return value.replace(/[\s-]/g, '');
}
