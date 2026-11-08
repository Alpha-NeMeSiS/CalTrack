import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewPasswordForm } from './NewPasswordForm';

const updatePassword = vi.fn();

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ updatePassword }),
}));

beforeEach(() => {
  updatePassword.mockReset();
});

async function fill(password: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nouveau mot de passe'), password);
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm);
  await user.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }));
}

describe('NewPasswordForm', () => {
  it('refuse un mot de passe trop court', async () => {
    render(<NewPasswordForm />);
    await fill('abc', 'abc');

    expect(screen.getByRole('alert')).toHaveTextContent('au moins 6 caractères');
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('refuse deux mots de passe différents', async () => {
    render(<NewPasswordForm />);
    await fill('secret123', 'secret124');

    expect(screen.getByRole('alert')).toHaveTextContent('ne correspondent pas');
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it('enregistre le nouveau mot de passe', async () => {
    updatePassword.mockResolvedValue({ error: null });
    const onDone = vi.fn();
    render(<NewPasswordForm onDone={onDone} />);
    await fill('secret123', 'secret123');

    expect(updatePassword).toHaveBeenCalledWith('secret123');
    expect(await screen.findByRole('status')).toHaveTextContent('Mot de passe modifié');
    expect(onDone).toHaveBeenCalled();
    expect(screen.getByLabelText('Nouveau mot de passe')).toHaveValue('');
  });

  it("affiche l'erreur de Supabase en français", async () => {
    updatePassword.mockResolvedValue({ error: new Error('New password should be different from the old password.') });
    render(<NewPasswordForm />);
    await fill('secret123', 'secret123');

    expect(await screen.findByRole('alert')).toHaveTextContent('doit être différent de l’ancien');
  });
});
