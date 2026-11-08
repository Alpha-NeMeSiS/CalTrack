import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteAllProfilePhotos, photoPathFromUrl, removeProfilePhoto, uploadProfilePhoto } from './profilePhoto';
import { getOperationArgs, supabaseMock } from '../test/supabaseMock';

const storage = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  list: vi.fn(),
  getPublicUrl: vi.fn((path: string) => ({
    data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/profile-pictures/${path}` },
  })),
}));

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: { ...fakeSupabase, storage: { from: () => storage } } };
});

// Le recadrage utilise canvas (absent de jsdom) : testé dans le navigateur
const resize = vi.hoisted(() => vi.fn());
vi.mock('../utils/image', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/image')>()),
  resizeImageToSquare: (...args: unknown[]) => resize(...args),
}));

const OLD_URL = 'https://x.supabase.co/storage/v1/object/public/profile-pictures/user-1/avatar-1.jpg?v=2';

beforeEach(() => {
  supabaseMock.reset();
  resize.mockReset().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
  storage.upload.mockReset().mockResolvedValue({ data: {}, error: null });
  storage.remove.mockReset().mockResolvedValue({ data: [], error: null });
  storage.list.mockReset().mockResolvedValue({ data: [{ name: 'avatar-1.jpg' }, { name: 'avatar-2.jpg' }], error: null });
});

describe('photo de profil', () => {
  it('retrouve le chemin du fichier à partir de son URL publique', () => {
    expect(photoPathFromUrl(OLD_URL)).toBe('user-1/avatar-1.jpg');
    expect(photoPathFromUrl('https://ailleurs.example/photo.jpg')).toBeNull();
    expect(photoPathFromUrl(null)).toBeNull();
  });

  it('envoie la photo réduite, l’associe au profil et supprime l’ancienne', async () => {
    const file = new File(['image'], 'moi.png', { type: 'image/png' });
    const url = await uploadProfilePhoto('user-1', file, OLD_URL);

    const [path, blob, options] = storage.upload.mock.calls[0];
    expect(path).toMatch(/^user-1\/avatar-\d+\.jpg$/);
    expect(blob).toBeInstanceOf(Blob);
    expect(options).toEqual({ contentType: 'image/jpeg', upsert: false });
    expect(url).toContain(path);

    const [update] = supabaseMock.callsFor('profiles', 'update');
    expect(getOperationArgs(update, 'update')?.[0]).toMatchObject({ profile_picture_url: url });
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
});
