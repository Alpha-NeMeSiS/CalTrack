/*
  # Audit A-18 : l'adresse d'abonnement push doit être un service connu

  ## Le problème
  La seule contrainte était « commence par https:// » :

      CHECK (endpoint LIKE 'https://%' AND char_length(endpoint) <= 2048)

  Un utilisateur connecté pouvait donc enregistrer n'importe quelle adresse, et
  l'Edge Function `send-reminders` lui enverrait des requêtes : l'application
  devenait un petit relais sortant.

  ## Après cette migration
  Seuls les services de push des navigateurs sont acceptés.

  ## ⚠️ Avant d'appliquer
  Vérifier que les abonnements existants passent la nouvelle contrainte, sinon
  la migration échoue :

      SELECT DISTINCT substring(endpoint from '^https://[^/]+') FROM public.push_subscriptions;

  Si un hôte légitime manque à la liste, l'ajouter ici avant d'appliquer.

  ## Note sur la reprise d'abonnement (non corrigée : c'est voulu)
  `save_push_subscription` fait `ON CONFLICT (endpoint) DO UPDATE SET user_id =
  EXCLUDED.user_id`. Qui connaîtrait l'adresse d'un autre appareil pourrait donc
  la rattacher à son compte. C'est le comportement attendu : il permet de
  changer de compte sur un même navigateur. L'adresse est une longue URL non
  devinable, et elle n'est lisible que par son propriétaire (RLS).
*/

ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_endpoint_check;

ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_check CHECK (
  char_length(endpoint) <= 2048
  AND (
    endpoint LIKE 'https://fcm.googleapis.com/%'                   -- Chrome, Edge, Android
    OR endpoint LIKE 'https://updates.push.services.mozilla.com/%' -- Firefox
    OR endpoint LIKE 'https://web.push.apple.com/%'                -- Safari, iOS
    OR endpoint LIKE 'https://%.notify.windows.com/%'              -- Windows (WNS)
    OR endpoint LIKE 'https://%.push.apple.com/%'                  -- Apple, autres régions
  )
);

COMMENT ON CONSTRAINT push_subscriptions_endpoint_check ON push_subscriptions IS
  'Audit A-18 : l''adresse doit appartenir à un service de push de navigateur, sinon l''Edge Function pourrait écrire vers n''importe quel hôte.';
