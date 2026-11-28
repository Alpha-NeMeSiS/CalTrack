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

    await userEvent.click(screen.getByRole('button', { name: 'CalTrack, retour au tableau de bord' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('garde le nom de l’app comme titre principal (le bouton est dans le titre)', () => {
    render(<Header onHome={vi.fn()} />);
    // HTML valide : un bouton peut être dans un <h1>, pas l'inverse
    const heading = screen.getByRole('heading', { level: 1, name: /CalTrack/ });
    expect(heading).toContainElement(screen.getByRole('button', { name: 'CalTrack, retour au tableau de bord' }));
  });
});
