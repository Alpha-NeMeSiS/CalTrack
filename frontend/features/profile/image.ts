// Préparation d'une photo de profil dans le navigateur : recadrage carré au
// centre et réduction (une photo de téléphone pèse souvent plusieurs Mo).

export const PROFILE_PHOTO_SIZE = 320;
/** Taille maximale du fichier choisi (avant réduction) */
export const PROFILE_PHOTO_MAX_INPUT_BYTES = 15 * 1024 * 1024;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Cette image n'a pas pu être lue."));
    };
    image.src = url;
  });
}

/** Recadre au centre en carré de `size` pixels et renvoie un JPEG */
export async function resizeImageToSquare(file: Blob, size = PROFILE_PHOTO_SIZE): Promise<Blob> {
  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sx = (image.naturalWidth - side) / 2;
  const sy = (image.naturalHeight - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error("Cette image n'a pas pu être préparée.");
  // Fond blanc : les zones transparentes d'un PNG ne deviennent pas noires en JPEG
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, sx, sy, side, side, 0, 0, size, size);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Cette image n'a pas pu être préparée."))),
      'image/jpeg',
      0.86
    );
  });
}
