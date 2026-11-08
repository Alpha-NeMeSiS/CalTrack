// Lecture des liens envoyés par Supabase Auth (fragment d'URL après redirection) :
// mot de passe oublié, confirmation d'inscription, changement d'email, lien
// expiré… Fonctions pures, testables.

export interface AuthNotice {
  type: 'success' | 'info' | 'error';
  text: string;
}

export interface AuthRedirect {
  /** Arrivée depuis le lien « mot de passe oublié » */
  isRecovery: boolean;
  /** Message à afficher à l'utilisateur, ou null */
  notice: AuthNotice | null;
  /** Le fragment ne contient qu'un message (pas de jeton) : on peut l'effacer de l'URL */
  isMessageOnly: boolean;
}

/** Message de Supabase après le 1er clic d'un changement d'email sécurisé */
const OTHER_EMAIL_PATTERN = /confirm link sent to the other email/i;

export function parseAuthRedirect(hash: string): AuthRedirect {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const type = params.get('type');
  const hasToken = params.has('access_token');
  const errorDescription = params.get('error_description');
  const message = params.get('message');

  const result: AuthRedirect = {
    isRecovery: hasToken && type === 'recovery',
    notice: null,
    isMessageOnly: !hasToken && Boolean(errorDescription || message),
  };

  if (errorDescription || params.get('error')) {
    const expired = params.get('error_code') === 'otp_expired' || /expired|invalid/i.test(errorDescription ?? '');
    result.notice = {
      type: 'error',
      text: expired
        ? 'Ce lien a expiré ou a déjà été utilisé. Refaites la demande depuis l’application.'
        : `Le lien n’a pas pu être utilisé${errorDescription ? ` : ${errorDescription}` : '.'}`,
    };
  } else if (message) {
    result.notice = {
      type: 'info',
      text: OTHER_EMAIL_PATTERN.test(message)
        ? 'Première confirmation reçue. Ouvrez maintenant le lien envoyé à l’autre adresse pour terminer le changement d’email.'
        : message,
    };
  } else if (hasToken && type === 'email_change') {
    result.notice = { type: 'success', text: 'Votre adresse email a été modifiée.' };
  } else if (hasToken && type === 'signup') {
    result.notice = { type: 'success', text: 'Adresse email confirmée. Bienvenue sur CalTrack !' };
  }

  return result;
}
