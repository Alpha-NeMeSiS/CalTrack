/*
  # Moment de la pesée (2.4.0)

  Le poids varie d'un à deux kilos dans la journée. Seule la pesée du matin,
  à jeun, sert de référence au suivi ; une pesée « plus tard dans la journée »
  est gardée mais ne compte pas (sauf sans pesée du matin depuis 14 jours,
  règle appliquée par l'application).

  ## Nouvelle colonne `weight_logs.moment`
    - `morning` : le matin, à jeun (valeur par défaut)
    - `later` : plus tard dans la journée

  ## Compatibilité
    - Les pesées existantes deviennent des pesées du matin : l'historique ne
      change pas.
    - La version 2.3.0 n'envoie pas le moment : la valeur par défaut
      s'applique, et un enregistrement sans moment garde celui déjà en base.
    - Une pesée par jour (UNIQUE (user_id, date)) : inchangé.

  Migration idempotente.
*/

ALTER TABLE public.weight_logs
  ADD COLUMN IF NOT EXISTS moment text NOT NULL DEFAULT 'morning'
  CONSTRAINT weight_logs_moment_check CHECK (moment IN ('morning', 'later'));

COMMENT ON COLUMN public.weight_logs.moment IS
  'Moment de la pesée : morning (le matin, à jeun, référence du suivi) ou later (plus tard dans la journée).';
