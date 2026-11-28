-- Moment de la pesée (2.4.0) : « morning » (le matin, à jeun) ou « later ».
-- L'application 2.3.0 n'envoie pas le moment : la valeur par défaut s'applique
-- et un enregistrement sans moment garde celui déjà en base.

SELECT test.create_user('alice');
SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (auth.uid(), '2026-11-20', 66.1);
SELECT test.ok(
  (SELECT moment = 'morning' FROM public.weight_logs WHERE user_id = auth.uid() AND date = '2026-11-20'),
  'pesée sans moment : le matin par défaut (anciennes pesées et version 2.3.0)'
);

SELECT test.raises(
  $$ INSERT INTO public.weight_logs (user_id, date, weight_kg, moment) VALUES (auth.uid(), '2026-11-21', 68, 'evening') $$,
  '23514',
  'pesée : moment inconnu refusé'
);

-- Même jour, moment « plus tard » envoyé : il remplace le moment enregistré
INSERT INTO public.weight_logs (user_id, date, weight_kg, moment) VALUES (auth.uid(), '2026-11-20', 66.1, 'later')
ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = EXCLUDED.weight_kg, moment = EXCLUDED.moment;
SELECT test.ok(
  (SELECT moment = 'later' FROM public.weight_logs WHERE user_id = auth.uid() AND date = '2026-11-20'),
  'pesée : le moment peut être corrigé'
);

-- Même jour, sans moment (upsert de la version 2.3.0) : le moment est conservé
INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (auth.uid(), '2026-11-20', 66.3)
ON CONFLICT (user_id, date) DO UPDATE SET weight_kg = EXCLUDED.weight_kg;
SELECT test.ok(
  (SELECT moment = 'later' AND weight_kg = 66.3 FROM public.weight_logs WHERE user_id = auth.uid() AND date = '2026-11-20'),
  'pesée : un enregistrement sans moment garde le moment déjà enregistré'
);

RESET ROLE;
