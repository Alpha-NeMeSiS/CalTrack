import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => ({ profile: null, signOut: vi.fn() }),
}));

describe('Header', () => {
  it('le logo est un bouton qui ramène au tableau de bord', async () => {
    const onHome = vi.fn();
    render(<Header onHome={onHome} />);

    await userEvent.click(screen.getByRole('button', { name: /^CalTrack\s+Suivi calorique personnalisé\s*,\s*retour au tableau de bord$/ }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('garde « CalTrack », et seulement lui, comme titre principal', () => {
    render(<Header onHome={vi.fn()} />);
    // Le libellé du bouton ne doit pas devenir celui du titre : « retour au
    // tableau de bord » polluait la navigation par titres des lecteurs
    // d'écran (et « tableau » contient « eau », titre de la carte Eau).
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName('CalTrack');
  });
});
