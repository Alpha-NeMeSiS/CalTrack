/*
  # Aliments personnels : valeurs estimées

  Un produit scanné sans valeurs nutritionnelles peut être enregistré dans
  « Mes aliments » avec une estimation d'après des produits proches
  (Open Food Facts). values_estimated le signale (badge « Estimé ») tant
  que les valeurs n'ont pas été corrigées avec l'étiquette.

  RLS et politiques existantes de foods inchangées.
*/

ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS values_estimated boolean NOT NULL DEFAULT false;
