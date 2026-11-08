// Photo de profil : stockage Supabase « profile-pictures », un dossier par
// utilisateur (les règles d'accès n'autorisent que son propre dossier).
import { supabase } from '../lib/supabase';
import { PROFILE_PHOTO_MAX_INPUT_BYTES, resizeImageToSquare } from '../utils/image';

export const PROFILE_PHOTOS_BUCKET = 'profile-pictures';

/** Chemin du fichier dans le stockage à partir de son URL publique (ou null) */
export function photoPathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/object/public/${PROFILE_PHOTOS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
}

async function setProfilePhotoUrl(userId: string, url: string | null) {
  const { error } = await supabase
    .from('profiles')
    .update({ profile_picture_url: url, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error("La photo n'a pas pu être enregistrée sur votre profil.");
}

async function removeFiles(paths: string[]) {
  if (paths.length === 0) return;
  // Sans gravité si cela échoue : le fichier n'est plus utilisé
  await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove(paths).catch(() => undefined);
}

/**
 * Prépare (recadrage, réduction), envoie la photo et l'associe au profil.
 * L'ancienne photo est ensuite supprimée. Renvoie la nouvelle URL publique.
 */
export async function uploadProfilePhoto(userId: string, file: File, previousUrl?: string | null): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choisissez une image (JPEG, PNG, WebP…).');
  if (file.size > PROFILE_PHOTO_MAX_INPUT_BYTES) throw new Error('Cette image est trop lourde (15 Mo maximum).');

  const blob = await resizeImageToSquare(file);
  // Nom unique : la nouvelle photo s'affiche tout de suite (pas d'ancienne version en cache)
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error("La photo n'a pas pu être envoyée. Réessayez.");

  const { data } = supabase.storage.from(PROFILE_PHOTOS_BUCKET).getPublicUrl(path);
  await setProfilePhotoUrl(userId, data.publicUrl);

  const previousPath = photoPathFromUrl(previousUrl);
  if (previousPath && previousPath !== path) await removeFiles([previousPath]);
  return data.publicUrl;
}

/** Retire la photo du profil et supprime le fichier */
export async function removeProfilePhoto(userId: string, currentUrl: string | null | undefined): Promise<void> {
  await setProfilePhotoUrl(userId, null);
  const path = photoPathFromUrl(currentUrl);
  if (path) await removeFiles([path]);
}

/** Supprime toutes les photos de l'utilisateur (avant la suppression du compte) */
export async function deleteAllProfilePhotos(userId: string): Promise<void> {
  const { data } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).list(userId, { limit: 100 });
  await removeFiles((data ?? []).map((file) => `${userId}/${file.name}`));
}
