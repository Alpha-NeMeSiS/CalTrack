# CalTrack

Application web de suivi calorique construite avec **React + TypeScript + Vite**, connectée à **Supabase** pour l'authentification, le profil utilisateur et le stockage des données nutritionnelles.

## Fonctionnalités

- Authentification (inscription / connexion).
- Onboarding utilisateur (profil physique + paramètres de base).
- Tableau de bord journalier avec suivi calories/macros.
- Gestion d'objectifs (perte, maintien, prise) avec calcul des cibles.
- Historique et tendances hebdomadaires.
- Recherche d'aliments : base Ciqual locale et produits du commerce Open Food Facts (via une fonction Netlify qui interroge `search.openfoodfacts.org`).
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

> **Recherche Open Food Facts en local** : elle passe par la fonction Netlify `netlify/functions/off-search.ts` (route `/api/off/search`, voir `netlify.toml`), qui interroge le service de recherche `search.openfoodfacts.org` (l'ancien `cgi/search.pl` est trop limité en débit et répond souvent 503). Avec `npm run dev` seul, cette route n'existe pas et la recherche « Produits supermarché » affiche « Service OFF indisponible ». Pour la tester en local, lancer le projet avec la [Netlify CLI](https://docs.netlify.com/cli/get-started/) :
>
> ```bash
> npx netlify dev
> ```
>
> La recherche Ciqual (« Aliments génériques ») fonctionne dans les deux cas.

## Scripts disponibles

- `npm run dev` : lance le serveur de développement.
- `npm run build` : génère la version de production.
- `npm run preview` : prévisualise le build localement.
- `npm run lint` : exécute ESLint.
- `npm run typecheck` : vérifie les types TypeScript.
- `npm test` : lance tous les tests une fois.
- `npm run test:watch` : relance les tests à chaque modification.
- `npm run test:coverage` : génère un rapport de couverture dans `coverage/`.

## Tests

Les tests utilisent **Vitest** (environnement `jsdom`) et **Testing Library**. Ils sont placés à côté du code testé (`*.test.ts` / `*.test.tsx`) et ne nécessitent ni `.env` ni connexion Supabase : le client Supabase est remplacé par un faux client.

| Dossier | Ce qui est testé |
| --- | --- |
| `src/utils/` | Calculs nutritionnels, dates locales, logique des objectifs, validation des formulaires |
| `src/contexts/` | Session et chargement du profil (`AuthContext`) |
| `src/lib/` | Recherche Ciqual, Open Food Facts (fetch mocké), progression temporelle |
| `src/services/` | Accès Supabase des objectifs et cibles quotidiennes |
| `src/components/` | Composants React (Dashboard, AddEntryModal, FoodSearch, LoginForm, MacroCard, CalorieRing) |
| `netlify/tests/` | Fonction Netlify `off-search` (proxy Open Food Facts) |

Outils partagés dans `src/test/` :

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

Les migrations SQL se trouvent dans `supabase/migrations/`. Elles sont **alignées sur l'historique de la base de production** (mêmes versions et mêmes noms) : `supabase migration list` doit afficher les mêmes migrations en local et à distance.

| Version | Rôle |
| --- | --- |
| `20251023212206` | Schéma initial : `profiles`, `goals`, `daily_targets`, `foods`, `entries`, politiques RLS, 12 aliments de base |
| `20251024092148` | Durée et poids cible des objectifs |
| `20251105090451` → `20251205192400` | Migrations historiques de la base (catégories d'aliments, champs de profil, jetons de réinitialisation, bucket `profile-pictures`) |
| `20261107235401` | Poids de départ des objectifs (`goals.start_weight_kg`) |
| `20261108001500` | **Réconciliation** : une partie du schéma de production a été modifiée hors migrations. Cette migration amène une base neuve exactement au même état que la production (sans effet sur la production elle-même). |
| `20261108011723` | Journal de pesées (`weight_logs`, une pesée par jour, RLS) avec reprise des poids existants |
| `20261108012607` | Suppression de compte RGPD : fonction `delete_my_account()` (supprime l'utilisateur connecté, données effacées en cascade) |

Rejouer toutes les migrations sur une base vierge donne un schéma identique à la production (vérifié par empreinte des colonnes, contraintes, index, politiques RLS et buckets).

> Pour toute évolution du schéma, créer une nouvelle migration (`supabase migration new <nom>`) plutôt que de modifier la base depuis l'éditeur SQL, afin de garder l'historique aligné.

## Structure simplifiée

```text
netlify/
  functions/       # Fonctions Netlify (proxy Open Food Facts)
src/
  components/      # UI par domaine (Auth, Dashboard, Journal, Goals, Profile, Account, etc.)
  contexts/        # Contexte d'authentification (AuthContext) et hook useAuth
  lib/             # Clients/abstractions (supabase, APIs nutrition)
  services/        # Accès Supabase (objectifs, cibles quotidiennes)
  utils/           # Calculs métier, dates locales, logique des objectifs (fonctions pures)
  test/            # Outils partagés pour les tests
```

## Compte utilisateur (RGPD)

- **Mot de passe oublié** : le lien envoyé par Supabase ramène sur l'application, qui affiche l'écran « Nouveau mot de passe ». L'URL du site (production et, si besoin, `http://localhost:5173`) doit figurer dans **Supabase → Authentication → URL Configuration** (*Site URL* / *Redirect URLs*), sinon le lien renvoie vers l'URL par défaut du projet.
- **Export** : menu du compte (avatar) → Compte et sécurité → « Télécharger mes données » produit un fichier JSON (profil, objectifs, cibles quotidiennes, journal, pesées, aliments personnels).
- **Suppression** : menu du compte (avatar) → Compte et sécurité → « Supprimer définitivement mon compte » appelle la fonction SQL `delete_my_account()`, qui supprime l'utilisateur connecté ; toutes ses données sont effacées en cascade.

## Notes

- Le dataset `public/data/ciqual-min.json` permet un accès local à une base alimentaire minimale.
- Le projet est orienté mobile-first avec une interface compacte et lisible.
