// Photo de profil : stockage Supabase « profile-pictures », un dossier par
// utilisateur (les règles d'accès n'autorisent que son propre dossier).
//
// Audit A-02 : le seau était PUBLIC et sa politique de lecture n'avait ni
// clause TO ni contrôle de propriétaire, ce qui autorisait aussi le listage du
// dossier. Les photos sont désormais désignées par leur CHEMIN dans
// `profiles.profile_picture_url`, et affichées via une URL signée de courte
// durée. Les anciennes valeurs (URL publiques complètes) restent acceptées :
// voir photoPathFromUrl et signedPhotoUrl.
import { supabase } from '../../shared/supabase';
import { PROFILE_PHOTO_MAX_INPUT_BYTES, resizeImageToSquare } from './image';

export const PROFILE_PHOTOS_BUCKET = 'profile-pictures';

/** Durée de validité d'une URL signée (secondes) */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Chemin du fichier dans le stockage, à partir de ce qui est enregistré dans
 * `profiles.profile_picture_url` : un chemin (nouvelles valeurs) ou une ancienne
 * URL publique complète.
 */
export function photoPathFromUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const marker = `/object/public/${PROFILE_PHOTOS_BUCKET}/`;
  const index = value.indexOf(marker);
  if (index !== -1) {
    return decodeURIComponent(value.slice(index + marker.length).split('?')[0]);
  }
  // Ancienne URL d'un autre format (signée, rendue…) : on n'en déduit rien
  if (/^https?:\/\//.test(value)) return null;
  return value;
}

/**
 * URL affichable pour une photo de profil.
 * - valeur vide → null ;
 * - ancienne URL complète → renvoyée telle quelle (elle fonctionne tant que le
 *   seau est public ; après la migration A-02, l'utilisateur renvoie sa photo) ;
 * - chemin → URL signée, valable SIGNED_URL_TTL_SECONDS.
 */
export async function signedPhotoUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (/^https?:\/\//.test(value)) return value;
  const { data, error } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .createSignedUrl(value, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

async function setProfilePhotoUrl(userId: string, pathOrUrl: string | null) {
  const { error } = await supabase
    .from('profiles')
    .update({ profile_picture_url: pathOrUrl, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw new Error("La photo n'a pas pu être enregistrée sur votre profil.");
}

async function removeFiles(paths: string[]) {
  if (paths.length === 0) return;
  // Sans gravité si cela échoue : le fichier n'est plus utilisé
  await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove(paths).catch(() => undefined);
}

/**
 * Supprime toutes les photos de l'utilisateur. Contrairement à removeFiles,
 * les erreurs sont propagées : avant la suppression du compte, un échec doit
 * arrêter l'opération plutôt que de laisser un fichier sans propriétaire
 * (audit A-26).
 */
async function removeFilesStrict(paths: string[]) {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).remove(paths);
  if (error) throw new Error("Les photos n'ont pas pu être supprimées.");
}

/**
 * Prépare (recadrage, réduction), envoie la photo et l'associe au profil.
 * L'ancienne photo est ensuite supprimée. Renvoie le chemin enregistré
 * (voir signedPhotoUrl pour l'affichage).
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

  // On enregistre le CHEMIN, pas une URL : une URL signée expire, et une URL
  // publique rendrait la photo lisible par n'importe qui (audit A-02).
  await setProfilePhotoUrl(userId, path);

  const previousPath = photoPathFromUrl(previousUrl);
  if (previousPath && previousPath !== path) await removeFiles([previousPath]);
  return path;
}

/** Retire la photo du profil et supprime le fichier */
export async function removeProfilePhoto(userId: string, currentUrl: string | null | undefined): Promise<void> {
  await setProfilePhotoUrl(userId, null);
  const path = photoPathFromUrl(currentUrl);
  if (path) await removeFiles([path]);
}

/**
 * Supprime toutes les photos de l'utilisateur (avant la suppression du compte).
 * Lève une erreur en cas d'échec : l'appelant doit alors renoncer à supprimer
 * le compte, sinon le fichier resterait dans le stockage sans propriétaire.
 */
export async function deleteAllProfilePhotos(userId: string): Promise<void> {
  const { data, error } = await supabase.storage.from(PROFILE_PHOTOS_BUCKET).list(userId, { limit: 100 });
  if (error) throw new Error("La liste des photos n'a pas pu être lue.");
  await removeFilesStrict((data ?? []).map((file) => `${userId}/${file.name}`));
}
