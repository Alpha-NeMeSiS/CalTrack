/*
  # Ajout du poids de départ aux objectifs

  ## Changements

  1. **Table goals**
    - Ajout de `start_weight_kg` (numeric, nullable) : poids de l'utilisateur au
      moment où l'objectif est créé. Il permet de mesurer l'évolution réelle du
      poids (kg perdus/pris, progression vers le poids cible, « dans les temps »).
      Même contrainte que `profiles.poids_kg` : 0 < valeur <= 500.

  2. **Objectifs existants**
    - Le poids de départ des objectifs ACTIFS est initialisé avec le poids actuel
      du profil. C'est une approximation (le vrai poids de départ n'a jamais été
      enregistré), mais elle permet de suivre l'évolution à partir de maintenant.
      Sans cela, la progression resterait bloquée à 0.
    - Les objectifs inactifs restent à NULL (l'application gère cette absence).

  ## Notes

  - Migration idempotente : peut être rejouée sans erreur.
  - La colonne est nullable pour rester compatible avec les anciennes lignes.
*/

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS start_weight_kg numeric
  CHECK (start_weight_kg > 0 AND start_weight_kg <= 500);

COMMENT ON COLUMN goals.start_weight_kg IS
  'Poids (kg) de l''utilisateur à la création de l''objectif, pour mesurer l''évolution réelle.';

-- Initialise le poids de départ des objectifs actifs avec le poids actuel du profil
UPDATE goals AS g
SET start_weight_kg = p.poids_kg
FROM profiles AS p
WHERE g.user_id = p.id
  AND g.is_active = true
  AND g.start_weight_kg IS NULL;
