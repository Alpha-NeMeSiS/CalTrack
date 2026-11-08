/*
  # Suppression de compte (RGPD — droit à l'effacement)

  ## Fonction `public.delete_my_account()`
    - Appelée par l'application (RPC) par un utilisateur connecté.
    - Supprime UNIQUEMENT le compte de l'appelant (auth.uid()) dans auth.users.
    - Les données liées sont effacées en cascade par les clés étrangères :
      profiles → goals, daily_targets, entries, foods (personnels), weight_logs ;
      password_reset_tokens.

  ## Sécurité
    - SECURITY DEFINER : nécessaire pour supprimer dans auth.users.
    - search_path vide et noms qualifiés (protection contre le détournement
      de search_path).
    - Exécution réservée au rôle authenticated (retirée à PUBLIC et anon).
    - Refus explicite si aucun utilisateur n'est connecté.
*/

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id uuid := auth.uid();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié' USING ERRCODE = '28000';
  END IF;

  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

COMMENT ON FUNCTION public.delete_my_account() IS
  'Supprime le compte de l''utilisateur connecté et toutes ses données (cascade).';
