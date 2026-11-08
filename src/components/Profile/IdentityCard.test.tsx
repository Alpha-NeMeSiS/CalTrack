import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdentityCard } from './IdentityCard';
import { getOperationArgs, supabaseMock } from '../../test/supabaseMock';
import { makeProfile } from '../../test/fixtures';

const refreshProfile = vi.fn();
const authValue = {
  user: { id: 'user-1' },
  profile: makeProfile({ email: 'eva@example.com', first_name: null, last_name: null, profile_picture_url: null }),
  refreshProfile,
};
vi.mock('../../contexts/useAuth', () => ({ useAuth: () => authValue }));
vi.mock('../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

const photo = vi.hoisted(() => ({ upload: vi.fn(), remove: vi.fn() }));
vi.mock('../../services/profilePhoto', () => ({
  uploadProfilePhoto: (...args: unknown[]) => photo.upload(...args),
  removeProfilePhoto: (...args: unknown[]) => photo.remove(...args),
}));

beforeEach(() => {
  supabaseMock.reset();
  refreshProfile.mockReset().mockResolvedValue(undefined);
  photo.upload.mockReset().mockResolvedValue('https://x/p.jpg');
  photo.remove.mockReset().mockResolvedValue(undefined);
  authValue.profile = makeProfile({ email: 'eva@example.com', first_name: null, last_name: null, profile_picture_url: null });
});

describe('IdentityCard', () => {
  it("affiche l'email et les initiales tant qu'aucun nom n'est renseigné", () => {
    render(<IdentityCard />);
    const card = screen.getByRole('region', { name: 'Identité' });
    expect(card).toHaveTextContent('eva@example.com');
    expect(card).toHaveTextContent('E');
    expect(screen.getByRole('button', { name: 'Ajouter une photo' })).toBeInTheDocument();
  });

  it('enregistre le prénom et le nom (espaces retirés, vide → aucun)', async () => {
    render(<IdentityCard />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Prénom'), '  Eva ');
    await user.click(screen.getByRole('button', { name: 'Enregistrer le nom' }));

    const [update] = supabaseMock.callsFor('profiles', 'update');
    expect(getOperationArgs(update, 'update')?.[0]).toMatchObject({ first_name: 'Eva', last_name: null });
    expect(refreshProfile).toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Nom enregistré');
  });

  it('envoie la photo choisie', async () => {
    render(<IdentityCard />);
    const file = new File(['image'], 'moi.jpg', { type: 'image/jpeg' });
    await userEvent.setup().upload(screen.getByLabelText('Choisir une photo de profil'), file);

    expect(photo.upload).toHaveBeenCalledWith('user-1', file, null);
    expect(await screen.findByRole('status')).toHaveTextContent('Photo mise à jour');
  });

  it("affiche l'erreur d'envoi de la photo", async () => {
    photo.upload.mockRejectedValue(new Error('Cette image est trop lourde (15 Mo maximum).'));
    render(<IdentityCard />);
    await userEvent.setup().upload(
      screen.getByLabelText('Choisir une photo de profil'),
      new File(['x'], 'grande.jpg', { type: 'image/jpeg' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('trop lourde');
  });

  it('montre la photo et permet de la retirer', async () => {
    authValue.profile = makeProfile({
      email: 'eva@example.com',
      first_name: 'Eva',
      last_name: 'Durand',
      profile_picture_url: 'https://x/p.jpg',
    });
    render(<IdentityCard />);
    expect(screen.getByRole('region', { name: 'Identité' }).querySelector('img')).toHaveAttribute('src', 'https://x/p.jpg');
    expect(screen.getByText('Eva Durand')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Retirer' }));
    expect(photo.remove).toHaveBeenCalledWith('user-1', 'https://x/p.jpg');
  });
});
