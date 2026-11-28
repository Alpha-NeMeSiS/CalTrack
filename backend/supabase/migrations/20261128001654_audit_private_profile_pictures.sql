/*
  # Audit A-02 : les photos de profil ne sont plus publiques

  ## Le problème
  Le seau `profile-pictures` était créé avec `public = true`, et sa politique de
  lecture était :

      CREATE POLICY "Everyone can view profile pictures"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'profile-pictures');

  Ni clause `TO` (elle s'appliquait donc au rôle PUBLIC, visiteurs anonymes
  compris), ni contrôle de propriétaire. Elle autorisait aussi l'API de
  listage : qui connaissait l'identifiant d'un utilisateur pouvait lister son
  dossier, y lire le nom exact du fichier, puis télécharger la photo — sans
  être connecté.

  ## Après cette migration
  Chacun ne lit, n'écrit et ne supprime que les fichiers de son dossier
  (`<user_id>/…`). L'affichage passe par une URL signée d'une heure.
  La politique de suppression existait déjà (migration 20261108125514, « Users
  can delete their own profile pictures ») : elle est seulement réécrite avec
  (SELECT auth.uid()), sous le même nom, pour ne pas créer de doublon.

  ## Photos déjà enregistrées
  `profiles.profile_picture_url` contenait une URL publique complète. La
  migration la remplace par le CHEMIN du fichier (`<user_id>/avatar-….jpg`),
  que le code 2.2.3 signe à l'affichage : personne n'a à renvoyer sa photo.

  ## Contrainte sur la colonne
  `profiles_profile_picture_url_check` (migration 20261108125514) exigeait une
  URL « https://… ». Une première tentative d'application de cette migration a
  échoué dessus, ce qui a révélé que l'envoi d'une photo par la 2.2.3 échouait
  aussi. Elle est remplacée par une contrainte qui exige un chemin situé dans le
  dossier du propriétaire du profil.

  ## Appliquée le 28/11/2026, après la mise en ligne de la 2.2.3
  Elle ne pouvait pas l'être avant : le code 2.2.2 affichait
  `profile_picture_url` tel quel dans un <img>, et n'aurait plus affiché aucune
  photo avec un chemin et un seau privé.
*/

-- La contrainte d'origine (migration 20261108125514) exigeait une URL
-- « https://… » : elle refuserait le chemin que le code 2.2.3 enregistre.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_profile_picture_url_check;

-- Photos déjà enregistrées : URL publique complète → chemin dans le seau
UPDATE public.profiles
   SET profile_picture_url = split_part(
         substring(profile_picture_url from '/object/public/profile-pictures/(.*)$'),
         '?', 1)
 WHERE profile_picture_url LIKE '%/object/public/profile-pictures/%';

-- Nouvelle contrainte, plus stricte : un chemin « <id du profil>/<fichier> »,
-- dans le dossier de son propriétaire uniquement.
ALTER TABLE public.profiles ADD CONSTRAINT profiles_profile_picture_url_check CHECK (
  profile_picture_url IS NULL
  OR (
    profile_picture_url ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,200}$'
    AND split_part(profile_picture_url, '/', 1) = id::text
  )
);

-- Le seau n'est plus servi sans jeton
UPDATE storage.buckets SET public = false WHERE id = 'profile-pictures';

-- Lecture : seulement ses propres fichiers, et seulement connecté
DROP POLICY IF EXISTS "Everyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own profile pictures" ON storage.objects;
CREATE POLICY "Users can view own profile pictures"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Suppression : politique déjà créée par 20261108125514 (même nom conservé).
-- Le second DROP couvre le nom d'une version antérieure de ce fichier.
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile pictures" ON storage.objects;
CREATE POLICY "Users can delete their own profile pictures"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- Envoi et remplacement : règles inchangées, réécrites avec (SELECT auth.uid())
-- pour qu'elles ne soient évaluées qu'une fois par requête (voir A-04).
DROP POLICY IF EXISTS "Users can upload their own profile pictures" ON storage.objects;
CREATE POLICY "Users can upload their own profile pictures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
CREATE POLICY "Users can update their own profile pictures"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
