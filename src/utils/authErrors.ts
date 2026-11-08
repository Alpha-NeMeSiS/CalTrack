// Messages lisibles (en français) pour les erreurs de Supabase Auth, qui sont
// renvoyées en anglais. Le code d'erreur est prioritaire ; le texte sert de
// repli pour les anciennes versions de l'API qui ne renvoient pas de code.

type AuthLikeError = Error & { status?: number; code?: string };

const RULES: { match: RegExp; text: string }[] = [
  {
    // Service d'email intégré de Supabase : n'envoie qu'aux membres du projet
    match: /email_address_not_authorized|email address not authorized/i,
    text: 'L’email n’a pas pu être envoyé à cette adresse : le service d’envoi n’est pas encore ouvert à tous. Réessayez plus tard.',
  },
  {
    match: /over_email_send_rate_limit|email rate limit/i,
    text: 'Trop d’emails envoyés : patientez quelques minutes avant de réessayer (pensez à vérifier vos courriers indésirables).',
  },
  { match: /invalid_credentials|invalid login credentials/i, text: 'Email ou mot de passe incorrect.' },
  {
    match: /email_not_confirmed|email not confirmed/i,
    text: 'Confirmez votre adresse email : cliquez sur le lien reçu par email, puis reconnectez-vous.',
  },
  { match: /user_already_exists|user already registered/i, text: 'Un compte existe déjà avec cette adresse.' },
  { match: /same_password|should be different from the old password/i, text: 'Le nouveau mot de passe doit être différent de l’ancien.' },
  {
    // « Changement sécurisé du mot de passe » : une session de plus de 24 h doit être confirmée
    match: /reauthentication_needed|requires reauthentication/i,
    text: 'Par sécurité, déconnectez-vous puis reconnectez-vous avant de changer votre mot de passe.',
  },
  { match: /weak_password|password is too weak/i, text: 'Mot de passe trop faible : choisissez-en un plus long et moins courant.' },
];

/** Message lisible pour une erreur d'authentification ; `fallback` si elle est inconnue. */
export function describeAuthError(error: AuthLikeError, fallback: string): string {
  const text = `${error.code ?? ''} ${error.message}`;
  const rule = RULES.find(({ match }) => match.test(text));
  if (rule) return rule.text;
  if (error.status === 429 || /rate.?limit/i.test(text)) {
    return 'Trop de tentatives : réessayez dans quelques minutes.';
  }
  return fallback;
}

/** Message lisible pour un changement d'adresse email qui a échoué */
export function describeEmailChangeError(error: AuthLikeError): string {
  const text = `${error.code ?? ''} ${error.message}`;
  if (/email_exists|already been registered|already registered/i.test(text)) {
    return 'Cette adresse est déjà utilisée par un autre compte.';
  }
  return describeAuthError(error, `Le changement d’adresse a échoué : ${error.message}`);
}
