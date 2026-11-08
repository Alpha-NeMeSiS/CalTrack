-- Suppression du compte (RGPD) : delete_my_account() efface l'utilisateur
-- connecté et toutes ses données, sans toucher aux autres comptes.

SELECT test.create_user('alice');
SELECT test.create_user('bob');

DO $$
DECLARE
  who text;
  v_goal uuid;
BEGIN
  FOREACH who IN ARRAY ARRAY['alice', 'bob'] LOOP
    INSERT INTO public.goals (user_id, type, activity_level) VALUES (test.uid(who), 'maintain', 1.4) RETURNING id INTO v_goal;
    INSERT INTO public.daily_targets (user_id, date, calories_kcal, protein_g, fat_g, carbs_g, goal_id)
    VALUES (test.uid(who), '2026-11-08', 2000, 140, 60, 220, v_goal);
    INSERT INTO public.entries (user_id, date, label, qty_grammes, kcal, protein_g, fat_g, carbs_g)
    VALUES (test.uid(who), '2026-11-08', 'Riz', 200, 260, 5, 1, 56);
    INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (test.uid(who), '2026-11-08', 70);
    INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g) VALUES (test.uid(who), 'Perso', 100, 1, 1, 1);
    INSERT INTO public.favorite_foods (user_id, label, kcal_per_100g, protein_g, fat_g, carbs_g) VALUES (test.uid(who), 'Favori', 100, 1, 1, 1);
    INSERT INTO public.user_preferences (user_id) VALUES (test.uid(who));
    INSERT INTO public.recipes (user_id, name, servings) VALUES (test.uid(who), 'Recette', 2);
    INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth)
    VALUES (test.uid(who), 'https://push.example.com/' || who, repeat('k', 60), repeat('a', 16));
  END LOOP;
END $$;

-- Sans session : refusé
SET ROLE authenticated;
SELECT test.raises($$ SELECT public.delete_my_account() $$, '28000', 'suppression impossible sans être connecté');

SELECT test.login(test.uid('alice'));
SELECT public.delete_my_account();
RESET ROLE;

DO $$
DECLARE
  tables text[] := ARRAY['goals', 'daily_targets', 'entries', 'weight_logs', 'foods', 'favorite_foods', 'user_preferences', 'push_subscriptions', 'recipes'];
  t text;
  remaining integer;
  kept integer;
BEGIN
  PERFORM test.ok(NOT EXISTS (SELECT 1 FROM auth.users WHERE id = test.uid('alice')), 'compte d''Alice supprimé');
  PERFORM test.ok(NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = test.uid('alice')), 'profil d''Alice supprimé');
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = %L', t, test.uid('alice')) INTO remaining;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = %L', t, test.uid('bob')) INTO kept;
    PERFORM test.ok(remaining = 0, format('%s : données d''Alice effacées', t));
    PERFORM test.ok(kept = 1, format('%s : données de Bob intactes', t));
  END LOOP;
END $$;

-- La fonction n'est pas accessible sans session
SET ROLE anon;
SELECT test.raises($$ SELECT public.delete_my_account() $$, '42501', 'fonction refusée aux visiteurs non connectés');
RESET ROLE;
