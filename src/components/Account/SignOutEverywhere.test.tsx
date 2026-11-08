import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SignOutEverywhere } from './SignOutEverywhere';

const signOutEverywhere = vi.fn().mockResolvedValue(undefined);
vi.mock('../../contexts/useAuth', () => ({ useAuth: () => ({ signOutEverywhere }) }));

describe('SignOutEverywhere', () => {
  it('demande une confirmation avant de déconnecter tous les appareils', async () => {
    render(<SignOutEverywhere />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Se déconnecter de tous les appareils' }));
    expect(signOutEverywhere).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: 'Se déconnecter de tous les appareils' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Se déconnecter de tous les appareils' }));
    await user.click(screen.getByRole('button', { name: 'Oui, me déconnecter partout' }));
    expect(signOutEverywhere).toHaveBeenCalledTimes(1);
  });
});
