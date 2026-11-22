import { describe, expect, it } from 'vitest';
import { getAvatarInitial, getDisplayName, getInitials } from './avatar';

describe('avatar', () => {
  it('utilise prénom et nom, sinon l’email', () => {
    expect(getInitials({ email: 'eva@example.com', first_name: 'éva', last_name: 'Durand' })).toBe('ÉD');
    expect(getInitials({ email: 'eva@example.com', first_name: 'Eva', last_name: null })).toBe('E');
    expect(getInitials({ email: '  42@example.com' })).toBe('4');
    expect(getAvatarInitial('---')).toBe('?');
  });

  it('affiche « Prénom Nom », sinon l’email', () => {
    expect(getDisplayName({ email: 'eva@example.com', first_name: ' Eva ', last_name: 'Durand' })).toBe('Eva Durand');
    expect(getDisplayName({ email: 'eva@example.com', first_name: '', last_name: null })).toBe('eva@example.com');
  });
});
