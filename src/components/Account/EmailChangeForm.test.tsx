import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailChangeForm } from './EmailChangeForm';

const updateEmail = vi.fn();
const authValue = {
  user: { id: 'user-1', email: 'eva@example.com', new_email: undefined as string | undefined },
  updateEmail,
};
vi.mock('../../contexts/useAuth', () => ({ useAuth: () => authValue }));

beforeEach(() => {
  updateEmail.mockReset();
  authValue.user.new_email = undefined;
});

async function submit(value: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nouvelle adresse email'), value);
  await user.click(screen.getByRole('button', { name: 'Changer d’adresse' }));
}

describe('EmailChangeForm', () => {
  it("affiche l'adresse actuelle", () => {
    render(<EmailChangeForm />);
    expect(screen.getByText('eva@example.com')).toBeInTheDocument();
  });

  it('refuse une adresse invalide ou identique', async () => {
    render(<EmailChangeForm />);
    await submit('pas-une-adresse');
    expect(screen.getByRole('alert')).toHaveTextContent('adresse email valide');

    await userEvent.setup().clear(screen.getByLabelText('Nouvelle adresse email'));
    await submit('EVA@example.com ');
    expect(screen.getByRole('alert')).toHaveTextContent('déjà l’adresse de votre compte');
    expect(updateEmail).not.toHaveBeenCalled();
  });

  it('demande le changement et explique la confirmation par lien', async () => {
    updateEmail.mockResolvedValue({ error: null });
    render(<EmailChangeForm />);
    await submit('Eva.Nouvelle@Example.com');

    expect(updateEmail).toHaveBeenCalledWith('eva.nouvelle@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Un lien de confirmation a été envoyé à eva.nouvelle@example.com'
    );
    expect(screen.getByLabelText('Nouvelle adresse email')).toHaveValue('');
  });

  it("traduit l'erreur « adresse déjà utilisée »", async () => {
    updateEmail.mockResolvedValue({
      error: Object.assign(new Error('A user with this email address has already been registered'), { status: 422 }),
    });
    render(<EmailChangeForm />);
    await submit('autre@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent('déjà utilisée par un autre compte');
  });

  it('signale un changement en attente de confirmation', () => {
    authValue.user.new_email = 'eva.nouvelle@example.com';
    render(<EmailChangeForm />);
    expect(screen.getByRole('status')).toHaveTextContent('Changement en attente vers eva.nouvelle@example.com');
  });
});
