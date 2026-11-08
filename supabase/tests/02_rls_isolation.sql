-- Isolation entre utilisateurs (RLS) : Bob ne voit, ne modifie, ne supprime
-- aucune donnée d'Alice, et ne peut pas en créer en son nom.

SELECT test.create_user('alice');
SELECT test.create_user('bob');

-- Aliment public (base commune) visible de tous
INSERT INTO public.foods (name, kcal_per_100g, protein_g, fat_g, carbs_g, is_public)
VALUES ('Pomme (test)', 52, 0.3, 0.2, 14, true);

-- Alice crée une donnée dans chaque table personnelle
SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

INSERT INTO public.goals (id, user_id, type, activity_level)
VALUES ('00000000-0000-0000-0000-0000000000a1', auth.uid(), 'loss', 1.55);
INSERT INTO public.daily_targets (user_id, date, calories_kcal, protein_g, fat_g, carbs_g, goal_id)
VALUES (auth.uid(), '2026-11-08', 2000, 140, 60, 220, '00000000-0000-0000-0000-0000000000a1');
INSERT INTO public.entries (user_id, date, label, qty_grammes, kcal, protein_g, fat_g, carbs_g)
VALUES (auth.uid(), '2026-11-08', 'Riz', 200, 260, 5, 1, 56);
INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (auth.uid(), '2026-11-08', 70);
INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g, barcode)
VALUES (auth.uid(), 'Granola maison', 450, 10, 18, 60, '3017620422003');
INSERT INTO public.favorite_foods (user_id, label, kcal_per_100g, protein_g, fat_g, carbs_g)
VALUES (auth.uid(), 'Yaourt nature', 53, 4, 1.5, 5.5);
INSERT INTO public.user_preferences (user_id) VALUES (auth.uid());
SELECT public.save_push_subscription('https://push.example.com/alice', repeat('k', 60), repeat('a', 16), 'Test');

SELECT test.ok(
  (SELECT count(*) FROM public.push_subscriptions WHERE user_id = auth.uid()) = 1,
  'Alice enregistre son abonnement aux notifications'
);
SELECT test.ok(
  EXISTS (SELECT 1 FROM public.foods WHERE is_public AND name = 'Pomme (test)'),
  'les aliments publics sont visibles'
);

-- Bob
SELECT test.login(test.uid('bob'));

DO $$
DECLARE
  tables text[] := ARRAY['goals', 'daily_targets', 'entries', 'weight_logs', 'foods', 'favorite_foods', 'user_preferences', 'push_subscriptions'];
  t text;
  visible integer;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = %L', t, test.uid('alice')) INTO visible;
    PERFORM test.ok(visible = 0, format('%s : Bob ne voit pas les lignes d''Alice', t));
    PERFORM test.ok(
      test.affected(format('DELETE FROM public.%I WHERE user_id = %L', t, test.uid('alice'))) = 0,
      format('%s : Bob ne peut pas supprimer les lignes d''Alice', t)
    );
  END LOOP;
END $$;

SELECT test.ok(
  (SELECT count(*) FROM public.profiles WHERE id = test.uid('alice')) = 0,
  'profiles : Bob ne voit pas le profil d''Alice'
);
SELECT test.ok(
  test.affected(format($$ UPDATE public.profiles SET poids_kg = 99 WHERE id = %L $$, test.uid('alice'))) = 0,
  'profiles : Bob ne peut pas modifier le profil d''Alice'
);
SELECT test.ok(
  test.affected(format($$ UPDATE public.entries SET kcal = 0 WHERE user_id = %L $$, test.uid('alice'))) = 0,
  'entries : Bob ne peut pas modifier le journal d''Alice'
);
SELECT test.ok(
  test.affected($$ UPDATE public.foods SET kcal_per_100g = 0 WHERE is_public $$) = 0,
  'foods : un aliment public n''est pas modifiable'
);

-- Créer des lignes au nom d'Alice est refusé
SELECT test.raises(
  format($$ INSERT INTO public.entries (user_id, date, label, qty_grammes, kcal, protein_g, fat_g, carbs_g)
            VALUES (%L, '2026-11-08', 'Piège', 100, 100, 1, 1, 1) $$, test.uid('alice')),
  '42501', 'entries : insertion au nom d''un autre refusée'
);
SELECT test.raises(
  format($$ INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (%L, '2026-11-09', 50) $$, test.uid('alice')),
  '42501', 'weight_logs : insertion au nom d''un autre refusée'
);
SELECT test.raises(
  format($$ INSERT INTO public.favorite_foods (user_id, label, kcal_per_100g, protein_g, fat_g, carbs_g)
            VALUES (%L, 'Piège', 1, 1, 1, 1) $$, test.uid('alice')),
  '42501', 'favorite_foods : insertion au nom d''un autre refusée'
);
SELECT test.raises(
  format($$ INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g)
            VALUES (%L, 'Piège', 1, 1, 1, 1) $$, test.uid('alice')),
  '42501', 'foods : aliment personnel au nom d''un autre refusé'
);
SELECT test.raises(
  $$ INSERT INTO public.foods (name, kcal_per_100g, protein_g, fat_g, carbs_g, is_public) VALUES ('Piège public', 1, 1, 1, 1, true) $$,
  '42501', 'foods : un utilisateur ne peut pas créer d''aliment public'
);

-- Un même endpoint réenregistré par Bob passe à Bob (changement de compte sur l'appareil)
SELECT public.save_push_subscription('https://push.example.com/alice', repeat('k', 60), repeat('b', 16), 'Test');
RESET ROLE;
SELECT test.ok(
  (SELECT user_id FROM public.push_subscriptions WHERE endpoint = 'https://push.example.com/alice') = test.uid('bob'),
  'push : l''appareil réenregistré appartient au dernier compte connecté'
);

-- Sans session, l'API ne voit rien
SELECT set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
SELECT test.ok((SELECT count(*) FROM public.entries) = 0, 'anonyme : aucune entrée visible');
SELECT test.ok((SELECT count(*) FROM public.profiles) = 0, 'anonyme : aucun profil visible');
RESET ROLE;
