-- Visite guidée et fenêtre « Quoi de neuf ? » : tour_completed_at et
-- last_seen_version, vides par défaut, modifiables seulement sur son compte.

SELECT test.create_user('alice');
SELECT test.create_user('bob');

-- Bob a une ligne de préférences, sans visite ni version vue
SELECT test.login(test.uid('bob'));
SET ROLE authenticated;
INSERT INTO public.user_preferences (user_id) VALUES (auth.uid());
RESET ROLE;

SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

INSERT INTO public.user_preferences (user_id) VALUES (auth.uid());
SELECT test.ok((SELECT tour_completed_at FROM public.user_preferences) IS NULL, 'visite pas encore vue par défaut');
SELECT test.ok((SELECT last_seen_version FROM public.user_preferences) IS NULL, 'aucune version vue par défaut');

-- Fin de la visite : visite et version enregistrées ensemble (comme markTourCompleted)
SELECT test.ok(
  test.affected($$ UPDATE public.user_preferences SET tour_completed_at = now(), last_seen_version = '2.1.0' $$) = 1,
  'Alice enregistre sa visite et sa version vue'
);
SELECT test.ok((SELECT last_seen_version FROM public.user_preferences) = '2.1.0', 'version vue relue');

-- Pas d'accès aux préférences de Bob
SELECT test.ok(
  test.affected(format($$ UPDATE public.user_preferences SET last_seen_version = '9.9.9' WHERE user_id = %L $$, test.uid('bob'))) = 0,
  'Alice ne modifie pas la version vue de Bob'
);

RESET ROLE;
SELECT test.ok(
  (SELECT last_seen_version FROM public.user_preferences WHERE user_id = test.uid('bob')) IS NULL,
  'la version vue de Bob est intacte'
);
