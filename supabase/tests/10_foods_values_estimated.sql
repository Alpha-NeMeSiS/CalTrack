-- Valeurs estimées (produit scanné sans valeurs) : values_estimated vaut false
-- par défaut et ne se modifie que sur ses propres aliments.

SELECT test.create_user('alice');
SELECT test.create_user('bob');

-- Bob a un aliment personnel
SELECT test.login(test.uid('bob'));
SET ROLE authenticated;
INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g, barcode)
VALUES (auth.uid(), 'Galette de Bob', 375, 7.5, 15, 52.5, '3017620422003');
RESET ROLE;

SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g, barcode)
VALUES (auth.uid(), 'PastaBox bolognaise', 123, 6.7, 3, 16, '3242272270157');
SELECT test.ok(
  (SELECT values_estimated FROM public.foods WHERE barcode = '3242272270157') = false,
  'un aliment personnel n''est pas estimé par défaut'
);

SELECT test.ok(
  test.affected($$ UPDATE public.foods SET values_estimated = true WHERE barcode = '3242272270157' $$) = 1,
  'Alice marque son aliment comme estimé'
);

SELECT test.ok(
  test.affected(format($$ UPDATE public.foods SET values_estimated = true WHERE user_id = %L $$, test.uid('bob'))) = 0,
  'Alice ne modifie pas l''aliment de Bob'
);

RESET ROLE;
SELECT test.ok(
  (SELECT values_estimated FROM public.foods WHERE user_id = test.uid('bob')) = false,
  'l''aliment de Bob est intact'
);
