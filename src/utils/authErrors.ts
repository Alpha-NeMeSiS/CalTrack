// Messages lisibles pour les erreurs de Supabase Auth.

/** Message lisible pour les erreurs courantes de Supabase */
export function describeEmailChangeError(error: Error & { status?: number; code?: string }): string {
  const text = `${error.code ?? ''} ${error.message}`;
  if (/email_exists|already been registered|already registered/i.test(text)) {
    return 'Cette adresse est déjà utilisée par un autre compte.';
  }
  if (error.status === 429 || /rate.?limit/i.test(text)) {
    return 'Trop de demandes : réessayez dans quelques minutes.';
  }
  return `Le changement d’adresse a échoué : ${error.message}`;
}
