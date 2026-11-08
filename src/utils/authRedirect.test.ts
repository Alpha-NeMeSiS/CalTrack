import { describe, expect, it } from 'vitest';
import { parseAuthRedirect } from './authRedirect';

describe('parseAuthRedirect', () => {
  it('reconnaît le lien « mot de passe oublié »', () => {
    expect(parseAuthRedirect('#access_token=abc&refresh_token=r&type=recovery')).toEqual({
      isRecovery: true,
      notice: null,
      isMessageOnly: false,
    });
  });

  it('signale un lien expiré (message en français, fragment effaçable)', () => {
    const result = parseAuthRedirect(
      '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'
    );
    expect(result.notice).toEqual({ type: 'error', text: expect.stringContaining('a expiré') });
    expect(result.isMessageOnly).toBe(true);
    expect(result.isRecovery).toBe(false);
  });

  it('traduit la première étape du changement d’email sécurisé', () => {
    const result = parseAuthRedirect(
      '#message=Confirmation+link+accepted.+Please+proceed+to+confirm+link+sent+to+the+other+email'
    );
    expect(result.notice).toEqual({ type: 'info', text: expect.stringContaining('l’autre adresse') });
    expect(result.isMessageOnly).toBe(true);
  });

  it('confirme la fin d’un changement d’email et une inscription', () => {
    expect(parseAuthRedirect('#access_token=abc&type=email_change').notice).toEqual({
      type: 'success',
      text: 'Votre adresse email a été modifiée.',
    });
    expect(parseAuthRedirect('#access_token=abc&type=signup').notice?.type).toBe('success');
  });

  it('ignore une URL sans fragment d’authentification', () => {
    expect(parseAuthRedirect('')).toEqual({ isRecovery: false, notice: null, isMessageOnly: false });
    expect(parseAuthRedirect('#section')).toEqual({ isRecovery: false, notice: null, isMessageOnly: false });
  });
});
