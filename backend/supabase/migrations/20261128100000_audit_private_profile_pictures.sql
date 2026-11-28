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
  La politique de suppression manquait aussi : sans elle, le remplacement d'une
  photo et le nettoyage avant suppression de compte échouaient en silence.

  ## Photos déjà enregistrées
  `profiles.profile_picture_url` contenait une URL publique complète. La
  migration la remplace par le CHEMIN du fichier (`<user_id>/avatar-….jpg`),
  que le code 2.2.3 signe à l'affichage : personne n'a à renvoyer sa photo.

  ## ⚠️ NON APPLIQUÉE — à appliquer seulement quand la 2.2.3 est en production
  La version de ce fichier est provisoire : la renommer avec celle que Supabase
  enregistre (`list_migrations`) une fois appliquée.
  Le code 2.2.2 affiche `profile_picture_url` tel quel dans un <img> : avec un
  chemin et un seau privé, il n'afficherait plus aucune photo. Il faut donc que
  la 2.2.3 (URL signées, signedPhotoUrl) soit déployée AVANT.
*/

-- Photos déjà enregistrées : URL publique complète → chemin dans le seau
UPDATE public.profiles
   SET profile_picture_url = split_part(
         substring(profile_picture_url from '/object/public/profile-pictures/(.*)$'),
         '?', 1)
 WHERE profile_picture_url LIKE '%/object/public/profile-pictures/%';

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

-- Suppression : elle manquait complètement
DROP POLICY IF EXISTS "Users can delete own profile pictures" ON storage.objects;
CREATE POLICY "Users can delete own profile pictures"
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
