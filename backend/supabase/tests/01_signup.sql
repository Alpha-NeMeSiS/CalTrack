-- Inscription : création du profil comme le fait l'onboarding, puis identité.
-- Régression : la valeur par défaut '' de first_name / last_name violait les
-- contraintes d'identité et bloquait toute création de profil (corrigé par
-- la migration 20261108162630).

INSERT INTO auth.users (id, email) VALUES (test.uid('alice'), 'alice@test.caltrack');
SELECT test.create_user('bob', false);

SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

-- L'onboarding fait un upsert sans prénom ni nom
INSERT INTO public.profiles (id, email, sexe, date_naissance, taille_cm, poids_kg)
VALUES (test.uid('alice'), 'alice@test.caltrack', 'F', '1992-04-12', 165, 60)
ON CONFLICT (id) DO UPDATE SET poids_kg = EXCLUDED.poids_kg;

SELECT test.ok(
  (SELECT first_name IS NULL AND last_name IS NULL FROM public.profiles WHERE id = test.uid('alice')),
  'profil créé à l''onboarding sans prénom ni nom (NULL)'
);

SELECT test.raises(
  format($$ INSERT INTO public.profiles (id, email, sexe, date_naissance, taille_cm, poids_kg)
            VALUES (%L, 'bob@test.caltrack', 'M', '1990-01-01', 170, 70) $$, test.uid('bob')),
  '42501',
  'impossible de créer le profil d''un autre utilisateur'
);

SELECT test.raises(
  $$ UPDATE public.profiles SET first_name = '   ' WHERE id = auth.uid() $$,
  '23514',
  'prénom vide refusé'
);
SELECT test.raises(
  $$ UPDATE public.profiles SET profile_picture_url = 'http://exemple.fr/a.jpg' WHERE id = auth.uid() $$,
  '23514',
  'photo de profil en http refusée (https uniquement)'
);

UPDATE public.profiles SET first_name = 'Alice', last_name = 'Martin' WHERE id = auth.uid();
SELECT test.ok(
  (SELECT first_name = 'Alice' FROM public.profiles WHERE id = auth.uid()),
  'prénom enregistré'
);

RESET ROLE;

-- Changement d'email confirmé côté Supabase Auth : le profil suit (déclencheur)
UPDATE auth.users SET email = 'alice.nouvelle@test.caltrack' WHERE id = test.uid('alice');
SELECT test.ok(
  (SELECT email FROM public.profiles WHERE id = test.uid('alice')) = 'alice.nouvelle@test.caltrack',
  'nouvel email recopié dans le profil'
);
