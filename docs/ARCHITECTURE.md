# Architecture de CalTrack

Ce document explique comment CalTrack est construit et **où trouver chaque chose** dans le code. Il complète le [README](../README.md) (installation, tests, fonctionnalités) et le [design system](design-system.md) (couleurs, composants).

## Vue d'ensemble

```text
Navigateur : l'app React (frontend/)
   │
   │  supabase-js : requêtes directes, sécurisées par la RLS
   ├──────────────► Supabase (backend/supabase/)
   │                  • Postgres : tables + règles RLS (migrations/)
   │                  • fonctions SQL (save_recipe, delete_my_account…)
   │                  • Edge Function send-reminders (rappels push, lancée par un cron)
   │                  • Auth : comptes, emails (templates/)
   │
   │  fetch /api/off/…
   └──────────────► Netlify Functions (backend/netlify/functions/)
                      • proxy Open Food Facts : recherche et code-barres
```

- **Il n'y a pas de serveur d'API classique.** L'app parle directement à la base avec `supabase-js`.
- **La sécurité est faite par Postgres** : chaque table a des règles RLS (*Row Level Security*) qui limitent chaque utilisateur à ses propres lignes (`user_id = auth.uid()`). Les tests de `backend/supabase/tests/` le vérifient.
- **Les fonctions Netlify** ne servent qu'à appeler Open Food Facts depuis un serveur. Le navigateur ne peut pas l'appeler directement, à cause des règles CORS et des limites de débit.
- **Le site** est servi par Netlify, qui construit l'app avec `npm run build` à la racine du dépôt et publie `dist/`.

## Les dossiers

```text
frontend/        ← tout ce qui tourne dans le navigateur
  app/           démarrage, navigation, session, mise en page
  features/      une fonctionnalité = un dossier
  shared/        ce qui sert à plusieurs fonctionnalités
  test/          outils communs aux tests
backend/         ← tout ce qui tourne sur un serveur
  supabase/      base de données, Edge Function, emails
  netlify/       proxy Open Food Facts
e2e/             tests de bout en bout (Playwright + axe)
public/          fichiers servis tels quels (icônes, service worker, manifeste)
docs/            documentation
scripts/         scripts (tests de la base)
```

### `frontend/features/` : une fonctionnalité = un dossier

Chaque dossier regroupe tout ce qui concerne une fonctionnalité, avec la même convention de noms :

| Fichier | Rôle | Exemple (`features/water/`) |
| --- | --- | --- |
| `*.tsx` | Écrans et composants React | `WaterCard.tsx` |
| `use*.ts` | Hooks React : état d'un écran, chargement | `useWaterDay.ts` |
| `*.ts` | Règles métier, **sans React ni réseau** (faciles à tester) | `water.ts` : objectif de 30 ml par kg, totaux, validation |
| `*.service.ts` | Accès à la base avec Supabase | `water.service.ts` : `fetchWaterLogs`, `addWaterLog`, `deleteWaterLog` |
| `*.test.ts(x)` | Tests, à côté du fichier testé | `water.test.ts`, `WaterCard.test.tsx` |

| Dossier | Contenu |
| --- | --- |
| `journal/` | Tableau de bord du jour, anneau des calories, macros, fenêtre « Ajouter un aliment », statut du jour, entrées du journal |
| `foods/` | Recherche (Ciqual, Open Food Facts), scanner, mes aliments, favoris et récents, produits similaires |
| `recipes/` | Recettes : liste, éditeur, portions |
| `water/` | Eau : carte, objectif, prises |
| `weight/` | Pesées et composition corporelle |
| `goals/` | Objectif, calculs (métabolisme de base, macros), validation des formulaires de profil et d'objectif |
| `stats/` | Tendances, graphiques, analyses, ajustement automatique des calories |
| `auth/` | Connexion, inscription, mot de passe oublié, messages d'erreur |
| `profile/` | Mon profil, photo, avatar |
| `account/` | Compte et sécurité : export, suppression, déconnexion partout |
| `settings/` | Paramètres d'affichage, préférences, thème |
| `reminders/` | Rappels (notifications push) |
| `onboarding/` | Création du profil à l'inscription |
| `tour/`, `guide/`, `about/`, `whats-new/` | Visite guidée, page Guide, page À propos, fenêtre « Quoi de neuf ? » (`releaseNotes.ts`) |

Une fonctionnalité peut importer un fichier d'une autre, par exemple `journal/` utilise les calculs de `goals/`. Ce qui sert presque partout va dans `shared/`.

### `frontend/app/` et `frontend/shared/`

| Dossier | Contenu |
| --- | --- |
| `app/` | `main.tsx` (point d'entrée), `App.tsx` (choix de l'écran), `navigation.ts` (vues de l'app), `appInfo.ts` (version), `index.css` (styles globaux et classes du design system) |
| `app/contexts/` | `AuthContext` / `useAuth` (utilisateur connecté, profil), `PreferencesContext` / `usePreferences` |
| `app/layout/` | En-tête, menu de l'avatar, navigation, pied de page |
| `shared/ui/` | Composants de base : `Button`, `Card`, `Badge`, `Field`, `InfoPage` |
| `shared/` | `supabase.ts` (client et types des tables), `date.ts`, `format.ts` (nombres à la française), `text.ts`, `timeProgress.ts`, `assets/` (logos) |

### `backend/`

| Dossier | Contenu |
| --- | --- |
| `supabase/migrations/` | Schéma SQL versionné : tables, RLS, fonctions SQL. Une migration par changement, jamais modifiée après application |
| `supabase/tests/` | Tests de la base (`npm run test:db`) : RLS, contraintes, fonctions SQL |
| `supabase/functions/send-reminders/` | Edge Function des rappels push (Deno) |
| `supabase/templates/` | Modèles des emails Supabase Auth, en français |
| `netlify/functions/` | `off-search.ts` (`/api/off/search`) et `off-product.ts` (`/api/off/product`) |
| `netlify/tests/` | Tests des fonctions Netlify |

## Où trouver quoi

| Je veux… | Je regarde… |
| --- | --- |
| Modifier l'écran du journal | `frontend/features/journal/Dashboard.tsx` |
| Modifier la fenêtre « Ajouter un aliment » | `frontend/features/journal/AddEntryModal.tsx`, et la recherche dans `features/foods/FoodSearch.tsx` |
| Changer le calcul des calories ou des macros | `frontend/features/goals/calculations.ts` et `goals.ts` |
| Changer une requête vers la base | le `*.service.ts` de la fonctionnalité |
| Ajouter une colonne ou une table | une nouvelle migration dans `backend/supabase/migrations/`, son test dans `backend/supabase/tests/`, puis le type dans `frontend/shared/supabase.ts` |
| Ajouter un écran au menu | `frontend/app/navigation.ts` (`AppView`), `frontend/app/App.tsx`, `frontend/app/layout/` |
| Modifier la recherche Open Food Facts | `frontend/features/foods/openfoodfacts.ts` (client) et `backend/netlify/functions/` (proxy) |
| Modifier les rappels push | `frontend/features/reminders/` (abonnement) et `backend/supabase/functions/send-reminders/` (envoi) |
| Changer une couleur ou un style commun | `tailwind.config.js`, `theme.palette.js`, `frontend/app/index.css`, et [design-system.md](design-system.md) |
| Écrire les notes d'une nouvelle version | `frontend/features/whats-new/releaseNotes.ts`, `CHANGELOG.md`, `package.json` |
| Modifier un email (inscription, mot de passe) | `backend/supabase/templates/` et [emails.md](emails.md) |

## Le trajet d'une donnée : « + 250 ml » d'eau

1. **Écran** : le bouton « + 250 ml » de `features/water/WaterCard.tsx` appelle le hook `useWaterDay`.
2. **Hook** : `features/water/useWaterDay.ts` appelle `addWaterLog(userId, date, 250)`.
3. **Service** : `features/water/water.service.ts` insère la ligne avec `supabase.from('water_logs').insert(…)`.
4. **Base** : Postgres vérifie la règle RLS de `water_logs` (on ne peut écrire que ses propres lignes) et la contrainte de quantité (de 1 à 3 000 ml). Ces règles viennent de la migration `…_water_logs.sql`.
5. **Retour** : la ligne enregistrée revient au hook, qui met l'état à jour. `water.ts` recalcule le total (`waterTotal`) et la progression vers l'objectif (`waterProgress`), et la carte se redessine.

Toutes les fonctionnalités suivent ce chemin : **écran → hook → service → base**, avec les règles métier dans les fichiers `*.ts`.

## Ajouter une fonctionnalité

1. **Base** (si besoin) :
   - écrire une migration dans `backend/supabase/migrations/` (table, RLS, contraintes) et son test dans `backend/supabase/tests/` ;
   - lancer `npm run test:db` ;
   - appliquer la migration au projet Supabase.
2. **Types** : ajouter le type de la table dans `frontend/shared/supabase.ts`.
3. **Dossier** : créer `frontend/features/<nom>/` avec :
   - le service (`<nom>.service.ts`) et ses tests ;
   - les règles métier (`<nom>.ts`) et leurs tests ;
   - les écrans (`*.tsx`) et leurs tests.
4. **Branchement** : ajouter l'écran dans `frontend/app/` (navigation, `App.tsx`), ou dans un écran existant.
5. **Accessibilité** : ajouter le parcours à `e2e/accessibility.spec.ts`.
6. **Textes** : mettre à jour le Guide (`features/guide/GuidePage.tsx`), les notes de version (`features/whats-new/releaseNotes.ts`), le `CHANGELOG.md` et la version dans `package.json`.
7. **Vérifier** : `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:a11y`.

## Les tests

| Type | Où | Commande |
| --- | --- | --- |
| Unitaires et composants (Vitest) | à côté du code, dans `frontend/` et `backend/` | `npm test` |
| Base de données (SQL) | `backend/supabase/tests/` | `npm run test:db` |
| Accessibilité et parcours (Playwright + axe) | `e2e/` | `npm run test:a11y` |

La CI (`.github/workflows/ci.yml`) lance les trois à chaque push et à chaque pull request.
