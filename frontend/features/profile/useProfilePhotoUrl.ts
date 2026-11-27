// URL affichable d'une photo de profil (audit A-02).
//
// `profiles.profile_picture_url` contient désormais le CHEMIN du fichier dans
// le stockage, et non une URL publique : la photo n'est plus lisible par
// n'importe qui. Il faut donc demander une URL signée avant de l'afficher.
// Les anciennes valeurs (URL complètes) sont renvoyées telles quelles.
import { useEffect, useState } from 'react';
import { signedPhotoUrl } from './profilePhoto.service';

/**
 * @param value contenu de `profile_picture_url` (chemin, ancienne URL, ou vide)
 * @returns l'URL à mettre dans `src`, ou null tant qu'elle n'est pas connue
 */
export function useProfilePhotoUrl(value: string | null | undefined): string | null {
  // Une URL complète est utilisable tout de suite : évite un affichage en deux
  // temps (initiales puis photo) pour les profils pas encore migrés.
  const immediate = value && /^https?:\/\//.test(value) ? value : null;
  const [url, setUrl] = useState<string | null>(immediate);

  useEffect(() => {
    if (!value) {
      setUrl(null);
      return;
    }
    if (/^https?:\/\//.test(value)) {
      setUrl(value);
      return;
    }

    // Chemin : URL signée, demandée de façon asynchrone
    let active = true;
    setUrl(null);
    signedPhotoUrl(value)
      .then((signed) => {
        if (active) setUrl(signed);
      })
      .catch(() => {
        // Photo inaccessible : l'avatar retombe sur les initiales
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  return url;
}
