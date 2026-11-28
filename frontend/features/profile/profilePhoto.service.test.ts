import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteAllProfilePhotos,
  photoPathFromUrl,
  removeProfilePhoto,
  signedPhotoUrl,
  uploadProfilePhoto,
} from './profilePhoto.service';
import { getOperationArgs, supabaseMock } from '../../test/supabaseMock';

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  getPublicUrl: vi.fn((path: string) => ({
    data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/profile-pictures/${path}` },
  })),
  createSignedUrl: vi.fn(
    (path: string): { data: { signedUrl: string } | null; error: Error | null } => ({
      data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/profile-pictures/${path}?token=abc` },
      error: null,
    })
  ),
}));

vi.mock('../../shared/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: { ...fakeSupabase, storage: { from: () => storage } } };
});

// Le recadrage utilise canvas (absent de jsdom) : testé dans le navigateur
const resize = vi.hoisted(() => vi.fn());
vi.mock('./image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./image')>()),
  resizeImageToSquare: (...args: unknown[]) => resize(...args),
}));

const OLD_URL = 'https://x.supabase.co/storage/v1/object/public/profile-pictures/user-1/avatar-1.jpg?v=2';

beforeEach(() => {
  supabaseMock.reset();
  resize.mockReset().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
  storage.upload.mockReset().mockResolvedValue({ data: {}, error: null });
  storage.remove.mockReset().mockResolvedValue({ data: [], error: null });
  storage.list.mockReset().mockResolvedValue({ data: [{ name: 'avatar-1.jpg' }, { name: 'avatar-2.jpg' }], error: null });
  storage.createSignedUrl.mockReset().mockImplementation((path: string) => ({
    data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/profile-pictures/${path}?token=abc` },
    error: null,
  }));
});

describe('photo de profil', () => {
  it('retrouve le chemin du fichier à partir de son URL publique (anciennes valeurs)', () => {
    expect(photoPathFromUrl(OLD_URL)).toBe('user-1/avatar-1.jpg');
    expect(photoPathFromUrl('https://ailleurs.example/photo.jpg')).toBeNull();
    expect(photoPathFromUrl(null)).toBeNull();
  });

  // Audit A-02 : on enregistre désormais le chemin, pas une URL
  it('accepte directement un chemin', () => {
    expect(photoPathFromUrl('user-1/avatar-9.jpg')).toBe('user-1/avatar-9.jpg');
  });

  it('envoie la photo réduite, l’associe au profil et supprime l’ancienne', async () => {
    const file = new File(['image'], 'moi.png', { type: 'image/png' });
    const url = await uploadProfilePhoto('user-1', file, OLD_URL);

    const [path, blob, options] = storage.upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/avatar-\d+\.jpg$/);
    expect(blob).toBeInstanceOf(Blob);
    expect(options).toEqual({ contentType: 'image/jpeg', upsert: false });

    // Audit A-02 : c'est le CHEMIN qui est enregistré, pas une URL publique
    expect(url).toBe(path);
    expect(url).not.toMatch(/^https?:\/\//);
    expect(storage.getPublicUrl).not.toHaveBeenCalled();

    const [update] = supabaseMock.callsFor('profiles', 'update');
    expect(getOperationArgs(update, 'update')?.[0]).toMatchObject({ profile_picture_url: path });
    expect(storage.remove).toHaveBeenCalledWith(['user-1/avatar-1.jpg']);
  });

  it('refuse un fichier qui n’est pas une image', async () => {
    const file = new File(['%PDF'], 'cv.pdf', { type: 'application/pdf' });
    await expect(uploadProfilePhoto('user-1', file)).rejects.toThrow('Choisissez une image');
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("signale un échec d'envoi sans toucher au profil", async () => {
    storage.upload.mockResolvedValue({ data: null, error: new Error('quota') });
    const file = new File(['image'], 'moi.jpg', { type: 'image/jpeg' });

    await expect(uploadProfilePhoto('user-1', file)).rejects.toThrow("n'a pas pu être envoyée");
    expect(supabaseMock.callsFor('profiles', 'update')).toHaveLength(0);
  });

  it('retire la photo du profil et supprime le fichier', async () => {
    await removeProfilePhoto('user-1', OLD_URL);
    const [update] = supabaseMock.callsFor('profiles', 'update');
    expect(getOperationArgs(update, 'update')?.[0]).toMatchObject({ profile_picture_url: null });
    expect(storage.remove).toHaveBeenCalledWith(['user-1/avatar-1.jpg']);
  });

  it("supprime toutes les photos de l'utilisateur", async () => {
    await deleteAllProfilePhotos('user-1');
    expect(storage.list).toHaveBeenCalledWith('user-1', { limit: 100 });
    expect(storage.remove).toHaveBeenCalledWith(['user-1/avatar-1.jpg', 'user-1/avatar-2.jpg']);
  });

  // Audit A-26 : un échec ne doit plus être avalé, sinon la suppression du
  // compte laisse un fichier sans propriétaire dans le stockage (RGPD).
  it('signale un échec de suppression avant la suppression du compte', async () => {
    storage.remove.mockResolvedValue({ data: null, error: new Error('réseau') });
    await expect(deleteAllProfilePhotos('user-1')).rejects.toThrow('pas pu être supprimées');
  });

  it('signale un échec de lecture de la liste', async () => {
    storage.list.mockResolvedValue({ data: null, error: new Error('réseau') });
    await expect(deleteAllProfilePhotos('user-1')).rejects.toThrow("pas pu être lue");
  });
});

// Audit A-02 : affichage d'une photo qui n'est plus publique
describe('signedPhotoUrl', () => {
  it('signe un chemin', async () => {
    const url = await signedPhotoUrl('user-1/avatar-9.jpg');
    expect(storage.createSignedUrl).toHaveBeenCalledWith('user-1/avatar-9.jpg', 3600);
    expect(url).toContain('token=abc');
  });

  it('renvoie telle quelle une ancienne URL complète', async () => {
    expect(await signedPhotoUrl(OLD_URL)).toBe(OLD_URL);
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('renvoie null sans valeur, ou si la signature échoue', async () => {
    expect(await signedPhotoUrl(null)).toBeNull();
    expect(await signedPhotoUrl('')).toBeNull();
    storage.createSignedUrl.mockResolvedValue({ data: null, error: new Error('refusé') });
    expect(await signedPhotoUrl('user-1/avatar-9.jpg')).toBeNull();
  });
});
