import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';

const signIn = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ signIn }),
}));

beforeEach(() => {
  signIn.mockReset();
});

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'eva@example.com');
  await user.type(screen.getByLabelText('Mot de passe'), 'secret123');
  await user.click(screen.getByRole('button', { name: 'Se connecter' }));
}

describe('LoginForm', () => {
  it('appelle signIn avec les identifiants saisis', async () => {
    signIn.mockResolvedValue({ error: null });
    render(<LoginForm onToggle={vi.fn()} />);

    await fillAndSubmit();

    expect(signIn).toHaveBeenCalledWith('eva@example.com', 'secret123');
    expect(screen.queryByText(/Invalid/)).not.toBeInTheDocument();
  });

  it("affiche le message d'erreur renvoyé", async () => {
    signIn.mockResolvedValue({ error: new Error('Invalid login credentials') });
    render(<LoginForm onToggle={vi.fn()} />);

    await fillAndSubmit();

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  });

  it("bascule vers l'inscription", async () => {
    const onToggle = vi.fn();
    render(<LoginForm onToggle={onToggle} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Créer un compte' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
