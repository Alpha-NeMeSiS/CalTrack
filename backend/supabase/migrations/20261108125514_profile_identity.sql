/*
  # Identité du profil : prénom, nom et photo

  Les colonnes profiles.first_name, last_name et profile_picture_url existent
  déjà (migration 20251205192400) mais n'étaient pas utilisées.

  1. Noms vides convertis en NULL, longueur limitée (1 à 50 caractères).
  2. Photo : URL https limitée à 500 caractères.
  3. Stockage « profile-pictures » :
     - chacun peut supprimer ses propres photos (remplacement / retrait) ;
     - 2 Mo maximum, formats JPEG, PNG et WebP.
*/

UPDATE profiles
SET first_name = NULLIF(btrim(first_name), ''),
    last_name = NULLIF(btrim(last_name), '')
WHERE first_name IS DISTINCT FROM NULLIF(btrim(first_name), '')
   OR last_name IS DISTINCT FROM NULLIF(btrim(last_name), '');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_first_name_check' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_first_name_check
      CHECK (first_name IS NULL OR char_length(btrim(first_name)) BETWEEN 1 AND 50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_last_name_check' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_last_name_check
      CHECK (last_name IS NULL OR char_length(btrim(last_name)) BETWEEN 1 AND 50);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_profile_picture_url_check' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_profile_picture_url_check
      CHECK (profile_picture_url IS NULL OR (profile_picture_url LIKE 'https://%' AND char_length(profile_picture_url) <= 500));
  END IF;
END $$;

-- Suppression de ses propres photos
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;
CREATE POLICY "Users can delete their own profile pictures"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'profile-pictures' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Taille et formats acceptés (colonnes présentes sur Supabase, absentes d'une base de test)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'storage' AND table_name = 'buckets' AND column_name = 'allowed_mime_types'
  ) THEN
    EXECUTE $sql$
      UPDATE storage.buckets
      SET file_size_limit = 2097152,
          allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
      WHERE id = 'profile-pictures'
    $sql$;
  END IF;
END $$;
