# CalTrack

Application web de suivi calorique construite avec **React + TypeScript + Vite**, connectée à **Supabase** pour l'authentification, le profil utilisateur et le stockage des données nutritionnelles.

## Version

Version actuelle : **2.2.0** (V2 : nouvelle direction artistique, scanner de code-barres, recettes, eau, pesées… ; 2.1 : visite guidée, Guide, fenêtre « Quoi de neuf ? » ; 2.2 : estimation d'un produit scanné sans valeurs). Le détail des évolutions est dans [CHANGELOG.md](CHANGELOG.md).

Pour une nouvelle version, mettre à jour `package.json` (`npm version minor --no-git-tag-version` pour une nouvelle fonctionnalité, `patch` pour un correctif, `major` pour une refonte) ajouter une entrée au CHANGELOG, et écrire les notes pour l'utilisateur dans `frontend/features/whats-new/releaseNotes.ts` (affichées par la fenêtre « Quoi de neuf ? » ; un test refuse une version sans notes). La version affichée dans l'app en découle automatiquement.

## Fonctionnalités

- Authentification (inscription / connexion).
- Onboarding utilisateur (profil physique + paramètres de base).
- Tableau de bord journalier avec suivi calories/macros.
- Gestion d'objectifs (perte, maintien, prise) avec calcul des cibles.
- Historique et tendances hebdomadaires.
- Recherche d'aliments : base Ciqual locale et produits du commerce Open Food Facts (via une fonction Netlify qui interroge `search.openfoodfacts.org`).
- Scanner de code-barres : avec l'appareil photo (ou en saisissant le code), le produit est retrouvé dans Open Food Facts et ses portions proposées. Produit sans valeurs : estimation d'après les produits les plus proches, à vérifier avec l'étiquette (badge « Estimé »).
- Favoris et aliments récents en haut de la recherche, ajoutables en un tap ; « Mes aliments » pour les produits saisis à la main (reconnus au scan).
- Ajout de plusieurs aliments à la suite : la fenêtre « Ajouter un aliment » reste ouverte après chaque ajout (confirmation, repas gardé) et se ferme avec la croix.
- Composition corporelle saisie avec les pesées (balance impédancemètre) et courbe masse grasse / masse maigre.
- Ajustement des calories proposé d'après la dépense réelle (repas saisis et pesées), à accepter ou non.
- Pied de page et page « À propos » (version, avertissement santé, données enregistrées, sources), accessibles aussi sans compte.
- Visite guidée au premier lancement, page « Guide » et fenêtre « Quoi de neuf ? » à chaque mise à jour.
- Persistance des données via Supabase (tables `profiles`, `goals`, `daily_targets`, `foods`, `entries`).

## Stack technique

- **Front-end**: React 18, TypeScript, Vite
- **UI**: Tailwind CSS
- **Backend BaaS**: Supabase (Auth + Postgres + RLS)
- **Qualité**: ESLint, TypeScript (`typecheck`), Vitest + Testing Library (tests)

## Prérequis

- Node.js 18+
- npm 9+
- Un projet Supabase avec les migrations appliquées

## Installation

```bash
npm install
```

## Variables d'environnement

Créer un fichier `.env` à la racine du projet:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

> L'application échoue au démarrage si ces variables sont absentes.

## Lancer le projet

```bash
npm run dev
```

Par défaut, Vite démarre sur `http://localhost:5173`.

> **Recherche Open Food Facts en local** : elle passe par la fonction Netlify `backend/netlify/functions/off-search.ts` (route `/api/off/search`, voir `netlify.toml`), qui interroge le service de recherche `search.openfoodfacts.org` (l'ancien `cgi/search.pl` est trop limité en débit et répond souvent 503). Avec `npm run dev` seul, cette route n'existe pas et la recherche « Produits supermarché » affiche « Service OFF indisponible ». Pour la tester en local, lancer le projet avec la [Netlify CLI](https://docs.netlify.com/cli/get-started/) :
>
> ```bash
> npx netlify dev
> ```
>
> La recherche Ciqual (« Aliments génériques ») fonctionne dans les deux cas. Le scanner de code-barres passe de même par `backend/netlify/functions/off-product.ts` (route `/api/off/product`).

## Scripts disponibles

- `npm run dev` : lance le serveur de développement.
- `npm run build` : génère la version de production.
- `npm run preview` : prévisualise le build localement.
- `npm run lint` : exécute ESLint.
- `npm run typecheck` : vérifie les types TypeScript.
- `npm test` : lance tous les tests une fois.
- `npm run test:watch` : relance les tests à chaque modification.
- `npm run test:coverage` : génère un rapport de couverture dans `coverage/`.
- `npm run test:db` : rejoue les migrations sur un Postgres vierge et lance les tests SQL (voir « Tests de la base de données »).
- `npm run test:a11y` : contrôle l'accessibilité des écrans principaux avec axe (voir « Accessibilité »).

## Tests

Les tests utilisent **Vitest** (environnement `jsdom`) et **Testing Library**. Ils sont placés à côté du code testé (`*.test.ts` / `*.test.tsx`) et ne nécessitent ni `.env` ni connexion Supabase : le client Supabase est remplacé par un faux client.

| Dossier | Ce qui est testé |
| --- | --- |
| `frontend/features/<fonctionnalité>/` | Écrans React, règles métier (`*.ts`) et accès à la base (`*.service.ts`, client Supabase simulé) |
| `frontend/app/` | Démarrage de l'app, navigation, session (`AuthContext`) et préférences |
| `frontend/shared/` | Composants de base (`ui/`), dates, format des nombres, progression temporelle |
| `frontend/test/` | Garde-fous du design system, contrastes de la palette, service worker |
| `backend/netlify/tests/` | Fonctions Netlify `off-search` et `off-product` (proxy Open Food Facts) |

### Accessibilité

`npm run test:a11y` construit l'application, la sert localement avec un Supabase simulé (`e2e/fixtures/supabase.ts`) et passe les écrans principaux (connexion, journal, ajout d'un aliment, tendances, objectif, profil, paramètres, compte) au crible d'**axe** (règles WCAG 2.2 A et AA), sur mobile et sur ordinateur, en thème clair et sombre. La CI (job « Accessibilité ») le lance à chaque push. En local, installer Chromium une fois : `npx playwright install chromium`.

Les couleurs, composants et règles d'interface sont décrits dans [`docs/design-system.md`](docs/design-system.md).

Outils partagés dans `frontend/test/` :

- `setup.ts` : initialisation (matchers `jest-dom`, nettoyage après chaque test) ;
- `supabaseMock.ts` : faux client Supabase qui enregistre les requêtes et renvoie les résultats choisis par le test ;
- `fixtures.ts` : données de test (`makeProfile`, `makeGoal`, `makeEntry`…).

Exemple de mock Supabase dans un test :

```ts
vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

supabaseMock.setHandler((call) =>
  call.table === 'entries' ? { data: [makeEntry()], error: null } : { data: null, error: null }
);
```

## Base de données

Les migrations SQL se trouvent dans `backend/supabase/migrations/`. Elles sont **alignées sur l'historique de la base de production** (mêmes versions et mêmes noms) : `supabase migration list --workdir backend` doit afficher les mêmes migrations en local et à distance (avec la CLI Supabase, `--workdir backend` indique où se trouve le dossier `supabase/`).

| Version | Rôle |
| --- | --- |
| `20251023212206` | Schéma initial : `profiles`, `goals`, `daily_targets`, `foods`, `entries`, politiques RLS, 12 aliments de base |
| `20251024092148` | Durée et poids cible des objectifs |
| `20251105090451` → `20251205192400` | Migrations historiques de la base (catégories d'aliments, champs de profil, jetons de réinitialisation, bucket `profile-pictures`) |
| `20261107235401` | Poids de départ des objectifs (`goals.start_weight_kg`) |
| `20261108001500` | **Réconciliation** : une partie du schéma de production a été modifiée hors migrations. Cette migration amène une base neuve exactement au même état que la production (sans effet sur la production elle-même). |
| `20261108011723` | Journal de pesées (`weight_logs`, une pesée par jour, RLS) avec reprise des poids existants |
| `20261108012607` | Suppression de compte RGPD : fonction `delete_my_account()` (supprime l'utilisateur connecté, données effacées en cascade) |
| `20261108020455` | Synchronisation de `profiles.email` quand l'adresse du compte change (déclencheur sur `auth.users`) |
| `20261108021351` | Préférences d'affichage (`user_preferences` : calories, macros, noms et visibilité des repas ; RLS) |
| `20261108022855` | Thème clair / sombre / automatique (`user_preferences.theme`) |
| `20261108023725` | Rappels push : table `push_subscriptions` (un abonnement par appareil), heures et fuseau des rappels, fonction `claim_due_reminders` |
| `20261108024047` | Planification des rappels : clés VAPID et secret dans Supabase Vault, tâche `pg_cron` toutes les 15 min appelant l'Edge Function `send-reminders` |
| `20261108125514` | Identité du profil : prénom, nom et photo (contraintes), suppression de ses photos et limites du stockage `profile-pictures` (2 Mo, JPEG / PNG / WebP) |
| `20261108162630` | Correctif : prénom et nom `NULL` par défaut (le `''` hérité bloquait la création du profil à l'onboarding depuis les contraintes d'identité) |
| `20261108162648` | Mesures détaillées facultatives du profil : taux d'eau, graisse viscérale, masse musculaire, masse osseuse (avec bornes) |
| `20261108170840` | Bibliothèque d'aliments : code-barres des aliments personnels (unique par utilisateur) et table `favorite_foods` (valeurs pour 100 g, quantité habituelle, RLS) |
| `20261108172544` | Composition corporelle facultative dans `weight_logs` (masse grasse, muscles, os, eau, graisse viscérale) et ajustement des calories accepté sur l'objectif (`goals.calorie_adjustment_kcal`, `calorie_adjustment_at`) |
| `20261108225422` | Recettes (`recipes`, `recipe_ingredients`) et fonction `save_recipe` |
| `20261108232714` | Suivi de l'eau (`water_logs`) et objectif manuel (`user_preferences.water_goal_ml`) |
| `20261122192854` | Visite guidée et « Quoi de neuf ? » : `user_preferences.tour_completed_at` et `last_seen_version` |
| `20261122205300` | Aliments personnels aux valeurs estimées : `foods.values_estimated` |

Rejouer toutes les migrations sur une base vierge donne un schéma identique à la production (vérifié par empreinte des colonnes, contraintes, index, politiques RLS et buckets).

> Pour toute évolution du schéma, créer une nouvelle migration (`supabase migration new <nom>`) plutôt que de modifier la base depuis l'éditeur SQL, afin de garder l'historique aligné.

### Tests de la base de données

`scripts/test-db.sh` (`npm run test:db`) crée une base vierge, y installe un environnement Supabase minimal (`backend/supabase/tests/setup.sql` : rôles `anon` / `authenticated` / `service_role`, `auth.users`, `auth.uid()` lisant l'utilisateur « connecté », droits par défaut), rejoue **toutes les migrations dans l'ordre**, puis exécute les tests SQL de `backend/supabase/tests/` (chacun dans une transaction annulée) :

| Fichier | Ce qui est vérifié |
| --- | --- |
| `01_signup.sql` | Création du profil comme l'onboarding (sans prénom ni nom), identité, synchronisation de l'email |
| `02_rls_isolation.sql` | Un utilisateur ne voit, ne modifie, ne supprime aucune donnée d'un autre, et ne peut pas en créer en son nom (toutes les tables personnelles) ; aliments publics en lecture seule ; rien de visible sans session |
| `03_constraints.sql` | Bornes et unicités (profil, pesées, journal, objectifs, aliments, favoris, préférences) |
| `04_weigh_in.sql` | Une pesée remise à jour garde la composition du jour |
| `05_delete_account.sql` | `delete_my_account()` efface tout le compte connecté et rien d'autre |
| `06_reminders.sql` | Rappels push dus à l'heure locale, une fois par jour, pas si l'action est faite ; réservés à la tâche planifiée |
| `07_recipes.sql` | Recettes et ingrédients isolés par compte, enregistrement en une opération |
| `08_water.sql` | Prises d'eau isolées par compte, quantités et objectif bornés |
| `09_tour_and_version.sql` | Visite guidée et version vue : vides par défaut, modifiables seulement sur son compte |
| `10_foods_values_estimated.sql` | Valeurs estimées : `false` par défaut, modifiables seulement sur ses aliments |

Outils (`backend/supabase/tests/helpers.sql`) : `test.create_user('nom')`, `test.login(test.uid('nom'))` puis `SET ROLE authenticated` pour agir comme l'API, `test.ok(condition, 'message')`, `test.raises($$ SQL $$, 'SQLSTATE', 'message')`.

En local, il faut un Postgres accessible (variables `PGHOST`, `PGUSER`, `PGPASSWORD`…) et un rôle qui peut créer des bases et des rôles. Par exemple avec Docker :

```bash
docker run -d --name caltrack-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:17
```

```bash
PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db
```

La CI (job « Base de données ») fait la même chose à chaque push et pull request, avec Postgres 17 comme la production.

## Structure simplifiée

Le code est séparé en deux : **`frontend/`** tourne dans le navigateur (l'app React), **`backend/`** tourne sur un serveur (base de données Supabase et fonctions Netlify).

Dans `frontend/features/`, **une fonctionnalité = un dossier** : on y trouve ses écrans (`*.tsx`), ses règles métier sans React ni réseau (`*.ts`), ses accès à la base (`*.service.ts`) et leurs tests à côté (`*.test.ts(x)`). Exemple pour l'eau : `WaterCard.tsx` (la carte), `water.ts` (objectif de 30 ml par kg), `water.service.ts` (lecture et écriture dans `water_logs`), et côté base `backend/supabase/migrations/…_water_logs.sql`.

```text
backend/           # Tout ce qui tourne côté serveur
  supabase/
    functions/     # Edge Functions (rappels push)
    migrations/    # Schéma SQL versionné (tables, RLS, fonctions SQL)
    templates/     # Modèles d'emails Supabase Auth en français
    tests/         # Tests de la base (npm run test:db)
  netlify/
    functions/     # Fonctions Netlify (proxy Open Food Facts : recherche, code-barres)
    tests/         # Tests des fonctions Netlify
frontend/          # Tout ce qui tourne dans le navigateur (l'app React)
  app/             # Démarrage (main.tsx, App.tsx), navigation, version, styles globaux
    contexts/      # Session (AuthContext, useAuth) et préférences (PreferencesContext)
    layout/        # En-tête, menu de l'avatar, navigation, pied de page
  features/        # Une fonctionnalité = un dossier
    journal/       # Tableau de bord, ajout d'aliment, statut du jour, entrées
    foods/         # Recherche, scanner, mes aliments, favoris, Ciqual, Open Food Facts, produits similaires
    recipes/       # Recettes
    water/         # Eau
    weight/        # Pesées et composition corporelle
    goals/         # Objectif, calculs caloriques (métabolisme, macros), validation des formulaires
    stats/         # Tendances, analyses, ajustement des calories
    auth/          # Connexion, inscription, mot de passe oublié
    profile/       # Mon profil, photo
    account/       # Compte et sécurité (export, suppression, déconnexion partout)
    settings/      # Paramètres, préférences d'affichage, thème
    reminders/     # Rappels (notifications push)
    onboarding/    # Création du profil à l'inscription
    tour/  guide/  about/  whats-new/   # Visite guidée, Guide, À propos, « Quoi de neuf ? »
  shared/          # Commun à toutes les fonctionnalités
    ui/            # Composants de base du design system (Button, Card, Badge, Field, InfoPage)
    assets/        # Logos
    supabase.ts    # Client Supabase et types des tables
    date.ts, format.ts, text.ts, timeProgress.ts
  test/            # Outils partagés pour les tests (setup, faux Supabase, données, garde-fous)
e2e/               # Contrôle d'accessibilité (Playwright + axe, Supabase simulé)
docs/
  design-system.md # Couleurs par rôle, composants, règles de contraste
  emails.md        # Configurer l'envoi des emails (SMTP, modèles)
```

## Compte utilisateur (RGPD)

- **Mot de passe oublié** : le lien envoyé par Supabase ramène sur l'application, qui affiche l'écran « Nouveau mot de passe ». L'URL du site (production et, si besoin, `http://localhost:5173`) doit figurer dans **Supabase → Authentication → URL Configuration** (*Site URL* / *Redirect URLs*), sinon le lien renvoie vers l'URL par défaut du projet.
- **Mon profil** (menu de l'avatar) : photo de profil (recadrée et réduite dans le navigateur, stockée dans `profile-pictures/<id utilisateur>/`), prénom, nom, email, mot de passe, repères, pesée et données corporelles. La photo et le nom s'affichent dans l'en-tête.
- **Mesures détaillées** (Mon profil → Données corporelles, facultatives) : masse musculaire, masse osseuse, eau corporelle, graisse viscérale (valeurs d'une balance impédancemètre ou d'un bilan). Elles servent à estimer la masse maigre (`estimateLeanMass`, dans cet ordre : masse grasse, puis muscles + os, puis muscles seuls, puis eau ÷ 0,732 ; une estimation invraisemblable est écartée). Avec une masse maigre connue, le métabolisme de base utilise Katch-McArdle, sinon Mifflin-St Jeor ; la formule suit les mesures actuelles du profil, y compris pour un objectif déjà créé. La graisse viscérale est un simple indicateur, sans effet sur le calcul.
- **Changement d'email** : menu du compte (avatar) → Mon profil. Supabase envoie un lien de confirmation (à l'ancienne et à la nouvelle adresse si *Secure email change* est activé dans Authentication → Providers → Email). L'adresse ne change qu'après confirmation ; `profiles.email` est alors mis à jour par un déclencheur SQL.
- **Déconnexion** : « Se déconnecter » (menu de l'avatar) ferme la session de cet appareil uniquement ; « Se déconnecter de tous les appareils » (Compte et sécurité) révoque toutes les sessions. La suppression du compte efface aussi les photos de profil.
- **Retour des liens** : un lien expiré ou déjà utilisé, ou la première étape d'un changement d'email, affiche un message en haut de l'écran.
- **Export** : menu du compte (avatar) → Compte et sécurité → « Télécharger mes données » produit un fichier JSON (profil, objectifs, cibles quotidiennes, journal, pesées, aliments personnels, favoris, préférences, recettes avec leurs ingrédients, prises d'eau).
- **Suppression** : menu du compte (avatar) → Compte et sécurité → « Supprimer définitivement mon compte » appelle la fonction SQL `delete_my_account()`, qui supprime l'utilisateur connecté ; toutes ses données sont effacées en cascade.

### Emails (SMTP et modèles en français)

Les emails d'inscription, de mot de passe oublié et de changement d'adresse sont envoyés par Supabase Auth. Le service d'envoi intégré de Supabase n'envoie qu'aux membres de l'organisation Supabase et seulement quelques emails par heure : pour les autres utilisateurs, il faut brancher un SMTP (Resend, Brevo…). Les modèles en français sont dans `backend/supabase/templates/` ; la marche à suivre (SMTP, limites d'envoi, sujets, tests) est dans [docs/emails.md](docs/emails.md). Les erreurs de Supabase Auth sont affichées en français (`frontend/features/auth/authErrors.ts`).

## Composition corporelle et ajustement des calories

- **Composition avec la pesée** : la carte « Ma pesée » a une section « Composition (facultatif) » (masse grasse, muscles, os, eau, graisse viscérale), enregistrée dans `weight_logs`. Une mesure laissée vide ne remplace pas celle déjà saisie ce jour-là. Pour la pesée la plus récente, les valeurs mettent aussi à jour le profil (et donc le métabolisme de base et la cible du jour).
- **Tendances → Composition corporelle** : masse grasse et masse maigre de chaque pesée avec composition (`compositionPoints`, même estimation de la masse maigre que le profil), avec leur évolution sur 90 jours.
- **Ajustement des calories** (`frontend/features/stats/calorieAdjustment.ts`) : à partir de la dépense réelle estimée sur 28 jours (`estimateExpenditure`), la cible qui garde le déficit ou le surplus de l'objectif est recalculée. Si elle s'écarte de plus de 100 kcal/j de la cible actuelle, Tendances propose de corriger : par pas de 300 kcal au plus, jamais sous le plancher de sécurité, au plus une fois par semaine. « Appliquer » enregistre `goals.calorie_adjustment_kcal` (ajouté aux calories calculées, protéines et lipides inchangés) et recalcule la cible du jour ; « Pas maintenant » masque la proposition 7 jours sur cet appareil. L'onglet Objectif affiche l'ajustement en cours et permet de l'annuler ; un nouvel objectif repart sans ajustement.

## Favoris, récents et mes aliments

Dans « Ajouter un aliment » :

- **Favoris et récents** : tant que la recherche est vide, la liste propose vos favoris puis vos aliments récents (tirés des 100 dernières entrées du journal, un par nom). Le bouton **+** ajoute l'aliment en un tap avec sa quantité et son repas habituels (les plus fréquents) ; un tap sur le nom le sélectionne pour ajuster la quantité ; l'étoile ajoute ou retire des favoris (aussi disponible sur l'aliment choisi). Un aliment choisi dans la recherche reprend sa quantité habituelle s'il est déjà connu. Les favoris sont stockés dans `favorite_foods` (valeurs pour 100 g, quantité habituelle).
- **Mes aliments** : la saisie manuelle peut enregistrer l'aliment (case « Enregistrer dans mes aliments ») avec un code-barres facultatif ; les valeurs peuvent être saisies pour la quantité indiquée ou pour 100 g (étiquette). Les aliments personnels (`foods` avec `user_id`) apparaissent en premier dans la recherche (badge « PERSO ») et sont reconnus au scan avant Open Food Facts. L'onglet « Mes aliments » permet de les utiliser ou de les supprimer.
- **Produit scanné inconnu** : « Créer cet aliment » ouvre la saisie manuelle pré-remplie (nom s'il est connu, code-barres, valeurs pour 100 g).

## Recettes (plats maison en parts)

Onglet « Recettes » de « Ajouter un aliment » :

- **Créer ou modifier** une recette : nom, nombre de parts (1 à 50), poids cuit total facultatif (pesez la casserole après cuisson) et ingrédients, cherchés comme d'habitude (aliments génériques, produits supermarché, scanner, mes aliments). Les totaux et les valeurs par part se mettent à jour en direct.
- **Ajouter au journal** : le bouton **+** ajoute 1 part au repas habituel de la recette ; un tap sur la recette permet de choisir la quantité en parts (par demi-part) ou en grammes si le poids cuit est connu, avec un aperçu de la ligne notée (« Chili maison — 1 part », « Chili maison — 380 g »).
- **Stockage** : tables `recipes` et `recipe_ingredients` (copie des valeurs pour 100 g de chaque ingrédient), enregistrées en une seule opération par la fonction SQL `save_recipe` (1 à 50 ingrédients, rien n'est enregistré en cas d'erreur). Une recette ajoutée devient une entrée ordinaire du journal : la modifier ou la supprimer ne change pas les repas déjà notés.

## Suivi de l'eau

- **Carte « Eau »** du journal (sous les calories et les macros) : total du jour et objectif, barre de progression, boutons « + 250 ml » et « + 500 ml », « Autre… » (de 1 à 3 000 ml) et « Annuler le dernier ». La carte suit la date choisie dans le journal.
- **Objectif** : automatique d'après le poids du profil (30 ml/kg, arrondi aux 100 ml, entre 1,5 et 4 L : 79 kg → 2,4 L), ou personnalisé dans Paramètres (de 0,5 à 6 L).
- **Tendances** : tuile « Eau moyenne » dans les 7 derniers jours (moyenne des jours notés, jours à l'objectif).
- **Stockage** : une ligne par prise d'eau dans `water_logs` ; l'objectif manuel dans `user_preferences.water_goal_ml` (vide = automatique).

## Pied de page et page « À propos »

- **Pied de page** sous chaque vue et sur l'écran de connexion : « CalTrack v2.2.0 · Guide · À propos · Vos données · Sources ». Une fois connecté, il cite aussi les sources nutritionnelles (Ciqual, Open Food Facts).
- **Page « À propos »** en quatre sections : l'application (version), santé (estimations, pas un dispositif médical), vos données (ce qui est enregistré, où, qui y a accès, combien de temps ; liens vers l'export et la suppression une fois connecté) et sources (Ciqual sous Licence Ouverte 2.0, Open Food Facts sous ODbL, formules utilisées). Chaque lien du pied de page ouvre la page sur sa section.
- **Version** : lue dans `package.json` au build (`__APP_VERSION__`, exposée par `frontend/app/appInfo.ts`) ; changer `version` suffit.

## Visite guidée, Guide et « Quoi de neuf ? »

- **Visite guidée** : 5 bulles au premier passage sur le journal (calories, ajout d'aliment, eau, pesée, navigation), passables, au clavier (Échap, Tab gardé dans la bulle). Les cibles sont repérées par `data-tour` ; la visite ne démarre pas sans objectif. Elle est mémorisée par compte (`user_preferences.tour_completed_at`) et se relance depuis le Guide (« Revoir la visite », sans rien enregistrer).
- **Page « Guide »** : 8 sections (premiers pas, repas, eau, pesée, objectif, tendances, réglages, installation sur le téléphone), depuis le pied de page, le menu de l'avatar et l'écran de connexion.
- **« Quoi de neuf ? »** : au lancement, quand la version de l'app est plus récente que `user_preferences.last_seen_version` ; versions manquées regroupées ; « C'est noté », la croix ou Échap l'enregistrent. Jamais en même temps que la visite : la fin de la visite marque aussi la version actuelle comme vue. L'historique se rouvre depuis « À propos » (« Voir les nouveautés »).
- **Notes de version** : `frontend/features/whats-new/releaseNotes.ts` (textes pour l'utilisateur) ; un test refuse une version de `package.json` sans notes.

## Scanner de code-barres

Ajouter un aliment → bouton « Scanner » (icône code-barres) à côté de la recherche :

1. La caméra arrière s'ouvre (autorisation demandée par le navigateur ; HTTPS obligatoire, `localhost` accepté en local).
2. Le code est lu par le `BarcodeDetector` natif du navigateur quand il existe (Chrome Android, macOS), sinon par le lecteur ZXing en WebAssembly (`barcode-detector/ponyfill`), chargé seulement à la première ouverture du scanner et servi par l'application (`zxing_reader.wasm`, mis en cache par le service worker). Formats lus : EAN-13, EAN-8 et UPC-A ; la clé de contrôle est vérifiée pour écarter les lectures erronées.
3. La caméra est coupée dès la lecture, puis la fiche est demandée à Open Food Facts via `/api/off/product?code=…` ; le produit trouvé ouvre directement le choix de la quantité (portion du fabricant si elle est connue).

Le code peut aussi être saisi à la main (caméra refusée, code abîmé, ordinateur sans caméra). Produit inconnu : un message invite à le chercher par son nom ou à le créer.

### Produit sans valeurs : produits similaires

Quand le produit est dans Open Food Facts sans valeurs nutritionnelles, CalTrack cherche les produits proches (`frontend/features/foods/similarProducts.ts`) :

1. **Mots du nom** : sans marque, quantités, mots vides ni pluriel (« Sodebo pastabox 330g fusilli a la bolognaise » → `pastabox fusilli bolognaise`).
2. **Deux recherches** en parallèle via `/api/off/search?size=30` : `brands:"<marque>" <mots>` puis `<mots>` (une recherche en échec est ignorée si l'autre répond).
3. **Produits retenus** : valeurs cohérentes (kcal ≈ 4 × protéines + 4 × glucides + 9 × lipides, à 20 % près), au moins un mot en commun, hors produit scanné et doublons.
4. **Score** = part des mots en commun (« Pasta Box » compte comme « pastabox ») + 0,25 pour la même marque.
5. **Estimation** d'après les produits au meilleur score (3 au plus) : le produit le plus proche, la moyenne de 2 ou la médiane de 3. Les 5 meilleurs sont proposés au choix.

Les valeurs pré-remplissent la saisie manuelle (bandeau « Valeurs estimées »). L'aliment est enregistré avec `foods.values_estimated = true` tant que les valeurs pré-remplies ne sont pas modifiées ; il porte alors le badge « Estimé » et propose « Corriger avec l'étiquette ».

## Paramètres d'affichage

Menu du compte (avatar) → Paramètres : thème (automatique, clair ou sombre — mémorisé sur l'appareil et dans le compte), calories du jour affichées « consommées / objectif » ou « restantes », macros en grammes ou en % de l'objectif, noms et visibilité des repas (un repas masqué n'est plus proposé à la saisie, les aliments déjà saisis restent affichés). Les choix sont enregistrés dans `user_preferences` ; sans ligne, les valeurs par défaut s'appliquent.

## Rappels (notifications push)

Paramètres → Rappels : rappel de pesée (si aucune pesée ce jour-là) et rappel du journal (si le dîner n'est pas noté), à l'heure choisie, sur les appareils où les notifications sont activées. À la première activation des notifications, les deux rappels sont programmés automatiquement (pesée 08:00, journal 20:30, ou les heures déjà cochées) ; les heures restent modifiables. Sur iPhone / iPad, l'application doit d'abord être installée sur l'écran d'accueil.

Fonctionnement :

1. Le navigateur s'abonne (Web Push) avec la clé publique VAPID fournie par l'Edge Function `send-reminders`, puis l'abonnement est enregistré (`save_push_subscription`).
2. Toutes les 15 minutes, `pg_cron` appelle l'Edge Function avec un secret partagé (Vault). Elle récupère les rappels dus (`claim_due_reminders`, selon le fuseau horaire de l'utilisateur, un envoi par jour au maximum), chiffre et envoie les notifications, et supprime les abonnements expirés.
3. Le service worker (`public/sw.js`) affiche la notification ; un clic ouvre l'application.

Les clés VAPID sont générées par l'Edge Function à son premier appel et stockées dans Supabase Vault : aucune clé n'est dans le dépôt. Code de l'Edge Function : `backend/supabase/functions/send-reminders/` (déployée avec `verify_jwt = false`, elle vérifie elle-même le secret de la tâche planifiée ou la session de l'utilisateur).

## Notes

- Le dataset `public/data/ciqual-min.json` permet un accès local à une base alimentaire minimale.
- Le projet est orienté mobile-first avec une interface compacte et lisible.
