/*
  # Synchronisation de l'email du profil

  Quand un utilisateur change d'adresse (lien de confirmation Supabase),
  seule la table auth.users est modifiée : profiles.email gardait l'ancienne
  adresse (affichée dans l'application et utilisée par l'export).

  ## Déclencheur `on_auth_user_email_updated` sur auth.users
    - Après une modification de auth.users.email, recopie la nouvelle adresse
      dans public.profiles.email pour le même utilisateur.
    - Fonction SECURITY DEFINER (écriture dans profiles quel que soit l'appelant),
      search_path vide et noms qualifiés ; non exécutable directement.

  ## Rattrapage
    - Aligne les profils déjà désynchronisés (aucun en production au moment
      de la migration).
*/

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET email = NEW.email,
      updated_at = now()
  WHERE id = NEW.id
    AND email IS DISTINCT FROM NEW.email;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM anon;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email AND NEW.email IS NOT NULL)
  EXECUTE FUNCTION public.sync_profile_email();

UPDATE public.profiles p
SET email = u.email,
    updated_at = now()
FROM auth.users u
WHERE u.id = p.id
  AND u.email IS NOT NULL
  AND p.email IS DISTINCT FROM u.email;
