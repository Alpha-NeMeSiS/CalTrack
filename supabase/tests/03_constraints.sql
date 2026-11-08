-- Contraintes : les valeurs aberrantes sont refusées par la base, même si
-- l'application les laissait passer.

SELECT test.create_user('alice');
SELECT test.login(test.uid('alice'));
SET ROLE authenticated;

-- Profil : mesures détaillées
SELECT test.raises($$ UPDATE public.profiles SET body_water_pct = 95 WHERE id = auth.uid() $$, '23514', 'profil : eau corporelle > 80 % refusée');
SELECT test.raises($$ UPDATE public.profiles SET visceral_fat_rating = 0 WHERE id = auth.uid() $$, '23514', 'profil : graisse viscérale < 1 refusée');
SELECT test.raises($$ UPDATE public.profiles SET muscle_mass_kg = 5 WHERE id = auth.uid() $$, '23514', 'profil : masse musculaire < 10 kg refusée');
SELECT test.raises($$ UPDATE public.profiles SET bone_mass_kg = 12 WHERE id = auth.uid() $$, '23514', 'profil : masse osseuse > 10 kg refusée');
UPDATE public.profiles SET body_water_pct = 55.4, visceral_fat_rating = 8, muscle_mass_kg = 54.2, bone_mass_kg = 2.9 WHERE id = auth.uid();
SELECT test.ok((SELECT muscle_mass_kg = 54.2 FROM public.profiles WHERE id = auth.uid()), 'profil : mesures plausibles acceptées');

-- Pesées
SELECT test.raises($$ INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (auth.uid(), '2026-11-01', 0) $$, '23514', 'pesée : poids nul refusé');
SELECT test.raises($$ INSERT INTO public.weight_logs (user_id, date, weight_kg, body_fat_pct) VALUES (auth.uid(), '2026-11-01', 70, 75) $$, '23514', 'pesée : masse grasse > 60 % refusée');
INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (auth.uid(), '2026-11-02', 70);
SELECT test.raises($$ INSERT INTO public.weight_logs (user_id, date, weight_kg) VALUES (auth.uid(), '2026-11-02', 71) $$, '23505', 'pesée : une seule par jour');

-- Journal
SELECT test.raises($$ INSERT INTO public.entries (user_id, date, label, qty_grammes, kcal, protein_g, fat_g, carbs_g) VALUES (auth.uid(), '2026-11-08', 'X', 0, 10, 1, 1, 1) $$, '23514', 'journal : quantité nulle refusée');
SELECT test.raises($$ INSERT INTO public.entries (user_id, date, label, qty_grammes, kcal, protein_g, fat_g, carbs_g) VALUES (auth.uid(), '2026-11-08', 'X', 100, -5, 1, 1, 1) $$, '23514', 'journal : calories négatives refusées');
SELECT test.raises($$ INSERT INTO public.entries (user_id, date, label, qty_grammes, kcal, protein_g, fat_g, carbs_g, meal_type) VALUES (auth.uid(), '2026-11-08', 'X', 100, 10, 1, 1, 1, 'brunch') $$, '23514', 'journal : type de repas inconnu refusé');

-- Objectifs
SELECT test.raises($$ INSERT INTO public.goals (user_id, type, activity_level) VALUES (auth.uid(), 'loss', 3) $$, '23514', 'objectif : niveau d''activité hors bornes refusé');
SELECT test.raises($$ INSERT INTO public.goals (user_id, type, activity_level, calorie_adjustment_kcal) VALUES (auth.uid(), 'loss', 1.5, 1500) $$, '23514', 'objectif : ajustement des calories > 1 000 kcal refusé');
INSERT INTO public.goals (user_id, type, activity_level) VALUES (auth.uid(), 'loss', 1.5);
SELECT test.ok((SELECT calorie_adjustment_kcal = 0 FROM public.goals WHERE user_id = auth.uid()), 'objectif : sans ajustement par défaut');

-- Mes aliments et favoris
SELECT test.raises($$ INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g, barcode) VALUES (auth.uid(), 'X', 1, 1, 1, 1, '12ab') $$, '23514', 'aliment : code-barres non numérique refusé');
SELECT test.raises($$ INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g) VALUES (auth.uid(), '  ', 1, 1, 1, 1) $$, '23514', 'aliment : nom vide refusé');
INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g, barcode) VALUES (auth.uid(), 'Galette', 480, 7, 22, 62, '3245678901236');
SELECT test.raises($$ INSERT INTO public.foods (user_id, name, kcal_per_100g, protein_g, fat_g, carbs_g, barcode) VALUES (auth.uid(), 'Autre', 1, 1, 1, 1, '3245678901236') $$, '23505', 'aliment : un code-barres au plus une fois par utilisateur');
INSERT INTO public.favorite_foods (user_id, label, kcal_per_100g, protein_g, fat_g, carbs_g) VALUES (auth.uid(), 'Yaourt nature', 53, 4, 1.5, 5.5);
SELECT test.raises($$ INSERT INTO public.favorite_foods (user_id, label, kcal_per_100g, protein_g, fat_g, carbs_g) VALUES (auth.uid(), ' YAOURT nature ', 53, 4, 1.5, 5.5) $$, '23505', 'favori : un même nom au plus une fois (casse et espaces ignorés)');
SELECT test.raises($$ INSERT INTO public.favorite_foods (user_id, label, kcal_per_100g, protein_g, fat_g, carbs_g) VALUES (auth.uid(), 'Huile', 1200, 0, 100, 0) $$, '23514', 'favori : plus de 900 kcal pour 100 g refusé');

-- Préférences
SELECT test.raises($$ INSERT INTO public.user_preferences (user_id, theme) VALUES (auth.uid(), 'rose') $$, '23514', 'préférences : thème inconnu refusé');

RESET ROLE;
