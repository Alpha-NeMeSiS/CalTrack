// Identité affichée (avatar, menu du compte) : fonctions pures, testables.

export interface IdentityLike {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

/** Initiale affichée dans l'avatar (première lettre ou chiffre de l'email) */
export function getAvatarInitial(email: string): string {
  const letter = email.trim().match(/[a-z0-9]/i)?.[0];
  return letter ? letter.toUpperCase() : '?';
}

/** Initiales : prénom + nom, sinon première lettre de l'email */
export function getInitials(identity: IdentityLike): string {
  const first = identity.first_name?.trim().charAt(0) ?? '';
  const last = identity.last_name?.trim().charAt(0) ?? '';
  const initials = `${first}${last}`.toLocaleUpperCase('fr-FR');
  return initials || getAvatarInitial(identity.email);
}

/** Nom affiché : « Prénom Nom », sinon l'email */
export function getDisplayName(identity: IdentityLike): string {
  const name = [identity.first_name?.trim(), identity.last_name?.trim()].filter(Boolean).join(' ');
  return name || identity.email;
}
