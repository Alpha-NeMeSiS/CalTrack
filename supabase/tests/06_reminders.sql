-- Rappels push : claim_due_reminders() renvoie les rappels dus à l'heure
-- locale de chaque utilisateur, une seule fois par jour, et pas si l'action
-- est déjà faite (pesée du jour, dîner noté).

SELECT test.create_user('alice');   -- Paris, pesée 08:00, journal 20:30
SELECT test.create_user('bob');     -- New York, pesée 08:00
SELECT test.create_user('carole');  -- rappels réglés mais aucun appareil abonné

INSERT INTO public.user_preferences (user_id, timezone, reminder_weigh_in_time, reminder_log_time) VALUES
  (test.uid('alice'), 'Europe/Paris', '08:00', '20:30'),
  (test.uid('bob'), 'America/New_York', '08:00', NULL),
  (test.uid('carole'), 'Europe/Paris', '08:00', '20:30');
INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth) VALUES
  (test.uid('alice'), 'https://push.example.com/alice', repeat('k', 60), repeat('a', 16)),
  (test.uid('bob'), 'https://push.example.com/bob', repeat('k', 60), repeat('b', 16));

-- 8 novembre 2026, 07:10 UTC = 08:10 à Paris (UTC+1), 02:10 à New York
CREATE TEMP TABLE claimed AS SELECT * FROM public.claim_due_reminders('2026-11-08 07:10:00+00');
SELECT test.ok(
  (SELECT count(*) = 1 FROM claimed WHERE user_id = test.uid('alice') AND kind = 'weigh_in' AND local_date = '2026-11-08'),
  'pesée d''Alice due à 08:10, heure de Paris'
);
SELECT test.ok(NOT EXISTS (SELECT 1 FROM claimed WHERE user_id = test.uid('bob')), 'rien pour Bob : il est 02:10 à New York');
SELECT test.ok(NOT EXISTS (SELECT 1 FROM claimed WHERE user_id = test.uid('carole')), 'rien pour Carole : aucun appareil abonné');
SELECT test.ok(NOT EXISTS (SELECT 1 FROM claimed WHERE kind = 'log'), 'pas de rappel du journal le matin');

SELECT test.ok(
  NOT EXISTS (SELECT 1 FROM public.claim_due_reminders('2026-11-08 07:40:00+00')),
  'un rappel n''est envoyé qu''une fois par jour'
);

-- Bob : 13:20 UTC = 08:20 à New York (UTC-5), mais il s'est déjà pesé
INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (test.uid('bob'), '2026-11-08', 80);
SELECT test.ok(
  NOT EXISTS (SELECT 1 FROM public.claim_due_reminders('2026-11-08 13:20:00+00') WHERE user_id = test.uid('bob')),
  'pas de rappel de pesée si la pesée du jour est faite'
);

-- Alice : 19:45 UTC = 20:45 à Paris, dîner pas encore noté
CREATE TEMP TABLE evening AS SELECT * FROM public.claim_due_reminders('2026-11-08 19:45:00+00');
SELECT test.ok(
  (SELECT count(*) = 1 FROM evening WHERE user_id = test.uid('alice') AND kind = 'log'),
  'rappel du journal d''Alice dû à 20:45 sans dîner noté'
);

-- Le lendemain, Alice a noté son dîner avant l'heure du rappel
INSERT INTO public.entries (user_id, date, label, qty_grammes, kcal, protein_g, fat_g, carbs_g, meal_type)
VALUES (test.uid('alice'), '2026-11-09', 'Soupe', 300, 150, 5, 3, 20, 'dinner');
SELECT test.ok(
  NOT EXISTS (SELECT 1 FROM public.claim_due_reminders('2026-11-09 19:45:00+00') WHERE user_id = test.uid('alice') AND kind = 'log'),
  'pas de rappel du journal si le dîner est noté'
);

-- Réservé à la tâche planifiée : interdit aux utilisateurs
SELECT test.login(test.uid('alice'));
SET ROLE authenticated;
SELECT test.raises($$ SELECT * FROM public.claim_due_reminders(now()) $$, '42501', 'claim_due_reminders refusé aux utilisateurs connectés');
RESET ROLE;
