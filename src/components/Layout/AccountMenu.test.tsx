import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccountMenu } from './AccountMenu';

function setup() {
  const onNavigate = vi.fn();
  const onSignOut = vi.fn();
  render(<AccountMenu email="eva@example.com" onNavigate={onNavigate} onSignOut={onSignOut} />);
  const button = screen.getByRole('button', { name: 'Menu du compte (eva@example.com)' });
  return { onNavigate, onSignOut, button, user: userEvent.setup() };
}

describe('AccountMenu', () => {
  it("affiche l'initiale de l'email et ouvre le menu", async () => {
    const { button, user } = setup();
    expect(button).toHaveTextContent('E');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Compte' })).toHaveTextContent('eva@example.com');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Mon profil',
      'Compte et sécurité',
      'Paramètres',
      'Se déconnecter',
    ]);
    // Le focus va sur la première option
    expect(screen.getByRole('menuitem', { name: 'Mon profil' })).toHaveFocus();
  });

  it('ouvre les pages Profil, Compte et Paramètres, puis se ferme', async () => {
    const { button, user, onNavigate } = setup();

    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Mon profil' }));
    expect(onNavigate).toHaveBeenLastCalledWith('profile');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Compte et sécurité' }));
    expect(onNavigate).toHaveBeenLastCalledWith('account');

    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Paramètres' }));
    expect(onNavigate).toHaveBeenLastCalledWith('settings');
  });

  it('déconnecte depuis le menu', async () => {
    const { button, user, onSignOut } = setup();
    await user.click(button);
    await user.click(screen.getByRole('menuitem', { name: 'Se déconnecter' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('se pilote au clavier : flèches, Échap rend le focus au bouton', async () => {
    const { button, user } = setup();
    button.focus();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Mon profil' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Compte et sécurité' })).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Se déconnecter' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('se ferme par un clic en dehors', async () => {
    const { button, user } = setup();
    await user.click(button);
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
    await user.click(backdrop);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
