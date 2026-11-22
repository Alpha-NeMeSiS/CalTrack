-- Suivi de l'eau : prises d'eau (water_logs) isolées par compte, quantités
-- bornées, pas de modification (on annule), objectif manuel borné.

SELECT test.create_user('alice');
SELECT test.create_user('bob');

SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

INSERT INTO public.water_logs (user_id, date, amount_ml) VALUES (auth.uid(), '2026-11-08', 250);
INSERT INTO public.water_logs (user_id, date, amount_ml) VALUES (auth.uid(), '2026-11-08', 500);

SELECT test.ok(
  (SELECT sum(amount_ml) FROM public.water_logs WHERE date = '2026-11-08') = 750,
  'total du jour : 250 + 500 ml'
);

-- Quantités bornées
SELECT test.raises($$ INSERT INTO public.water_logs (user_id, date, amount_ml) VALUES (auth.uid(), '2026-11-08', 0) $$, '23514', '0 ml refusé');
SELECT test.raises($$ INSERT INTO public.water_logs (user_id, date, amount_ml) VALUES (auth.uid(), '2026-11-08', 3001) $$, '23514', 'plus de 3 000 ml refusés');

-- Pas de modification : une prise d'eau s'annule (suppression)
SELECT test.ok(test.affected('UPDATE public.water_logs SET amount_ml = 1000') = 0, 'une prise d''eau ne se modifie pas');
SELECT test.ok(
  test.affected(format('DELETE FROM public.water_logs WHERE id = %L',
    (SELECT id FROM public.water_logs ORDER BY created_at DESC, amount_ml DESC LIMIT 1))) = 1,
  'annulation de la dernière prise'
);

-- Pas d'ajout au nom d'un autre compte
SELECT test.raises(
  format($$ INSERT INTO public.water_logs (user_id, date, amount_ml) VALUES (%L, '2026-11-08', 250) $$, test.uid('bob')),
  '42501', 'pas de prise d''eau au nom de Bob'
);

-- Isolation : Bob ne voit ni ne supprime les prises d'Alice
SELECT test.login(test.uid('bob'));
SELECT test.ok((SELECT count(*) FROM public.water_logs) = 0, 'Bob ne voit pas les prises d''Alice');
SELECT test.ok(test.affected('DELETE FROM public.water_logs') = 0, 'Bob ne supprime pas les prises d''Alice');

-- Objectif manuel : NULL (automatique) ou de 500 à 6 000 ml
INSERT INTO public.user_preferences (user_id) VALUES (auth.uid());
SELECT test.ok((SELECT water_goal_ml FROM public.user_preferences) IS NULL, 'objectif automatique par défaut');
UPDATE public.user_preferences SET water_goal_ml = 2500;
SELECT test.ok((SELECT water_goal_ml FROM public.user_preferences) = 2500, 'objectif manuel de 2,5 L accepté');
SELECT test.raises($$ UPDATE public.user_preferences SET water_goal_ml = 400 $$, '23514', 'objectif sous 0,5 L refusé');
SELECT test.raises($$ UPDATE public.user_preferences SET water_goal_ml = 6100 $$, '23514', 'objectif au-dessus de 6 L refusé');
UPDATE public.user_preferences SET water_goal_ml = NULL;
SELECT test.ok((SELECT water_goal_ml FROM public.user_preferences) IS NULL, 'retour à l''objectif automatique');

RESET ROLE;
