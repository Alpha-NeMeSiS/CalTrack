import { describe, expect, it } from 'vitest';
import { describeAuthError, describeEmailChangeError } from './authErrors';

/** Erreur telle que la renvoie supabase-js (AuthApiError : message, status, code) */
const authError = (message: string, extra: { status?: number; code?: string } = {}) =>
  Object.assign(new Error(message), extra);

describe('describeAuthError', () => {
  it('explique que le service d’envoi n’accepte pas encore cette adresse', () => {
    const text = describeAuthError(
      authError('Email address not authorized', { status: 400, code: 'email_address_not_authorized' }),
      'Échec.'
    );
    expect(text).toMatch(/n’a pas pu être envoyé à cette adresse/);
  });

  it('signale la limite d’envoi d’emails (code ou statut 429)', () => {
    expect(
      describeAuthError(authError('email rate limit exceeded', { status: 429, code: 'over_email_send_rate_limit' }), 'Échec.')
    ).toMatch(/Trop d’emails envoyés/);
    expect(describeAuthError(authError('For security purposes…', { status: 429 }), 'Échec.')).toMatch(/Trop de tentatives/);
  });

  it('traduit les erreurs de connexion et d’inscription courantes', () => {
    expect(describeAuthError(authError('Invalid login credentials', { code: 'invalid_credentials' }), 'Échec.')).toBe(
      'Email ou mot de passe incorrect.'
    );
    expect(describeAuthError(authError('Email not confirmed', { code: 'email_not_confirmed' }), 'Échec.')).toMatch(
      /Confirmez votre adresse email/
    );
    expect(describeAuthError(authError('User already registered', { code: 'user_already_exists' }), 'Échec.')).toBe(
      'Un compte existe déjà avec cette adresse.'
    );
    expect(describeAuthError(authError('Password is too weak', { code: 'weak_password' }), 'Échec.')).toMatch(
      /Mot de passe trop faible/
    );
    expect(
      describeAuthError(authError('New password should be different from the old password.', { code: 'same_password' }), 'Échec.')
    ).toBe('Le nouveau mot de passe doit être différent de l’ancien.');
    expect(
      describeAuthError(authError('Password update requires reauthentication', { code: 'reauthentication_needed' }), 'Échec.')
    ).toMatch(/déconnectez-vous puis reconnectez-vous/);
  });

  it('reconnaît aussi le texte de l’erreur quand le code manque', () => {
    expect(describeAuthError(new Error('Invalid login credentials'), 'Échec.')).toBe('Email ou mot de passe incorrect.');
  });

  it('utilise le message par défaut pour une erreur inconnue', () => {
    expect(describeAuthError(new Error('Something odd'), 'La connexion a échoué.')).toBe('La connexion a échoué.');
  });
});

describe('describeEmailChangeError', () => {
  it('garde les messages propres au changement d’adresse', () => {
    expect(describeEmailChangeError(authError('A user with this email address has already been registered', { code: 'email_exists' }))).toBe(
      'Cette adresse est déjà utilisée par un autre compte.'
    );
    expect(describeEmailChangeError(authError('Email address not authorized', { code: 'email_address_not_authorized' }))).toMatch(
      /n’a pas pu être envoyé à cette adresse/
    );
    expect(describeEmailChangeError(authError('email rate limit exceeded', { status: 429 }))).toMatch(/Trop d’emails envoyés/);
    expect(describeEmailChangeError(new Error('boom'))).toBe('Le changement d’adresse a échoué : boom');
  });
});
