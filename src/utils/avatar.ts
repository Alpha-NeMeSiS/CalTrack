/** Initiale affichée dans l'avatar (première lettre ou chiffre de l'email) */
export function getAvatarInitial(email: string): string {
  const letter = email.trim().match(/[a-z0-9]/i)?.[0];
  return letter ? letter.toUpperCase() : '?';
}
