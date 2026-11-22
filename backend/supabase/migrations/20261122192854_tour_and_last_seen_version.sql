-- Visite guidée et fenêtre « Quoi de neuf ? » (v2.1.0)
-- tour_completed_at : fin (ou abandon) de la visite guidée, vide tant qu'elle n'a pas été vue.
-- last_seen_version : dernière version de l'app dont les nouveautés ont été vues.
-- Les règles RLS existantes de user_preferences s'appliquent (chacun ses préférences).
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS tour_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_version text;
