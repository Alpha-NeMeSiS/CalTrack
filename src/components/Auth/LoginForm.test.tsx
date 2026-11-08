import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';

const signIn = vi.fn();
const requestPasswordReset = vi.fn();

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ signIn, requestPasswordReset }),
}));

beforeEach(() => {
  signIn.mockReset();
  requestPasswordReset.mockReset();
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

  it("envoie le lien « mot de passe oublié » à l'adresse saisie", async () => {
    requestPasswordReset.mockResolvedValue({ error: null });
    render(<LoginForm onToggle={vi.fn()} />);
    const user = userEvent.setup();

    // L'adresse déjà saisie est reprise dans le formulaire de réinitialisation
    await user.type(screen.getByLabelText('Email'), 'eva@example.com');
    await user.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));
    expect(screen.getByLabelText('Email')).toHaveValue('eva@example.com');

    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(requestPasswordReset).toHaveBeenCalledWith('eva@example.com');
    // Même message que le compte existe ou non (pas de divulgation des adresses)
    expect(await screen.findByRole('status')).toHaveTextContent('Si un compte existe pour eva@example.com');

    await user.click(screen.getByRole('button', { name: 'Retour à la connexion' }));
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it("signale l'échec de l'envoi du lien", async () => {
    requestPasswordReset.mockResolvedValue({ error: new Error('rate limit') });
    render(<LoginForm onToggle={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));
    await user.type(screen.getByLabelText('Email'), 'eva@example.com');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("L'email n'a pas pu être envoyé");
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
