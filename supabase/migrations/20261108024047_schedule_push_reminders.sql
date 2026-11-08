/*
  # Planification des rappels push

  ## Secrets (Supabase Vault, jamais écrits dans le dépôt)
    - push_vapid_public_key / push_vapid_private_key : clés VAPID, générées
      par l'Edge Function send-reminders à son premier appel.
    - reminders_cron_secret : secret partagé entre la tâche planifiée et
      l'Edge Function, généré ici dans la base.

  ## Fonctions (réservées au rôle service_role, utilisées par l'Edge Function)
    - get_push_vapid_keys() / init_push_vapid_keys(public, private)
    - check_reminders_cron_secret(secret)

  ## Tâche planifiée « caltrack-send-reminders » (pg_cron + pg_net)
    Toutes les 15 minutes, appelle l'Edge Function avec le secret partagé.
    Créée seulement si pg_cron, pg_net et Vault sont disponibles (absents
    d'une base locale de test : la migration y est sans effet).
*/

-- 1. Clés VAPID
CREATE OR REPLACE FUNCTION public.get_push_vapid_keys()
RETURNS TABLE (public_key text, private_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT pub.decrypted_secret, priv.decrypted_secret
  FROM vault.decrypted_secrets pub
  JOIN vault.decrypted_secrets priv ON priv.name = 'push_vapid_private_key'
  WHERE pub.name = 'push_vapid_public_key';
END;
$$;

CREATE OR REPLACE FUNCTION public.init_push_vapid_keys(p_public text, p_private text)
RETURNS TABLE (public_key text, private_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Les premières clés enregistrées sont conservées (appels simultanés)
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'push_vapid_private_key') THEN
    BEGIN
      PERFORM vault.create_secret(p_private, 'push_vapid_private_key', 'Clé privée VAPID des rappels CalTrack');
      PERFORM vault.create_secret(p_public, 'push_vapid_public_key', 'Clé publique VAPID des rappels CalTrack');
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END IF;
  RETURN QUERY SELECT * FROM public.get_push_vapid_keys();
END;
$$;

-- 2. Vérification du secret de la tâche planifiée
CREATE OR REPLACE FUNCTION public.check_reminders_cron_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'reminders_cron_secret' AND decrypted_secret = p_secret
  );
END;
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.get_push_vapid_keys()',
    'public.init_push_vapid_keys(text, text)',
    'public.check_reminders_cron_secret(text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $$;

-- 3. Tâche planifiée
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'vault') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'reminders_cron_secret') THEN
      PERFORM vault.create_secret(
        encode(extensions.gen_random_bytes(32), 'hex'),
        'reminders_cron_secret',
        'Secret partagé entre la tâche planifiée et l''Edge Function send-reminders'
      );
    END IF;

    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'caltrack-send-reminders';
    PERFORM cron.schedule(
      'caltrack-send-reminders',
      '*/15 * * * *',
      $cmd$
      SELECT net.http_post(
        url := 'https://ieriugqyfaabelpvqfjt.supabase.co/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reminders_cron_secret')
        ),
        body := jsonb_build_object('source', 'cron'),
        timeout_milliseconds := 30000
      );
      $cmd$
    );
  ELSE
    RAISE NOTICE 'pg_cron, pg_net ou Vault indisponible : rappels non planifiés sur cette base';
  END IF;
END $$;
