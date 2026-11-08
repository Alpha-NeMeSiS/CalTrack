-- Pesée avec composition : l'upsert de l'application n'envoie que les mesures
-- renseignées ; remettre à jour le poids du jour garde la composition.

SELECT test.create_user('alice');
SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

INSERT INTO public.weight_logs (user_id, date, weight_kg, body_fat_pct, muscle_mass_kg)
VALUES (auth.uid(), '2026-11-08', 70, 18.5, 54.2)
ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = EXCLUDED.weight_kg, body_fat_pct = EXCLUDED.body_fat_pct, muscle_mass_kg = EXCLUDED.muscle_mass_kg;

-- Même jour, poids seul (comme l'upsert PostgREST d'une pesée sans composition)
INSERT INTO public.weight_logs (user_id, date, weight_kg)
VALUES (auth.uid(), '2026-11-08', 69.8)
ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = EXCLUDED.weight_kg;

SELECT test.ok(
  (SELECT weight_kg = 69.8 AND body_fat_pct = 18.5 AND muscle_mass_kg = 54.2 FROM public.weight_logs WHERE user_id = auth.uid()),
  'le poids est mis à jour et la composition du jour conservée'
);
SELECT test.ok((SELECT count(*) = 1 FROM public.weight_logs WHERE user_id = auth.uid()), 'toujours une seule pesée ce jour-là');

RESET ROLE;
