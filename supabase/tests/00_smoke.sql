-- Vérification de l'outillage : une assertion qui passe et une erreur attendue
SELECT test.ok(true, 'les outils de test fonctionnent');
SELECT test.raises($$ SELECT 1 / 0 $$, '22012', 'test.raises reconnaît une erreur attendue');
