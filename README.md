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
| `20261108020455` | Synchronisation de `profiles.email` quand l'adresse du compte change (déclencheur sur `auth.users`) |
| `20261108021351` | Préférences d'affichage (`user_preferences` : calories, macros, noms et visibilité des repas ; RLS) |
| `20261108022855` | Thème clair / sombre / automatique (`user_preferences.theme`) |
| `20261108023725` | Rappels push : table `push_subscriptions` (un abonnement par appareil), heures et fuseau des rappels, fonction `claim_due_reminders` |
| `20261108024047` | Planification des rappels : clés VAPID et secret dans Supabase Vault, tâche `pg_cron` toutes les 15 min appelant l'Edge Function `send-reminders` |
| `20261108125514` | Identité du profil : prénom, nom et photo (contraintes), suppression de ses photos et limites du stockage `profile-pictures` (2 Mo, JPEG / PNG / WebP) |

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
supabase/
  functions/       # Edge Functions (rappels push)
  migrations/      # Schéma SQL versionné
  templates/       # Modèles d'emails Supabase Auth en français
docs/
  emails.md        # Configurer l'envoi des emails (SMTP, modèles)
```

## Compte utilisateur (RGPD)

- **Mot de passe oublié** : le lien envoyé par Supabase ramène sur l'application, qui affiche l'écran « Nouveau mot de passe ». L'URL du site (production et, si besoin, `http://localhost:5173`) doit figurer dans **Supabase → Authentication → URL Configuration** (*Site URL* / *Redirect URLs*), sinon le lien renvoie vers l'URL par défaut du projet.
- **Mon profil** (menu de l'avatar) : photo de profil (recadrée et réduite dans le navigateur, stockée dans `profile-pictures/<id utilisateur>/`), prénom, nom, email, mot de passe, repères, pesée et données corporelles. La photo et le nom s'affichent dans l'en-tête.
- **Changement d'email** : menu du compte (avatar) → Mon profil. Supabase envoie un lien de confirmation (à l'ancienne et à la nouvelle adresse si *Secure email change* est activé dans Authentication → Providers → Email). L'adresse ne change qu'après confirmation ; `profiles.email` est alors mis à jour par un déclencheur SQL.
- **Déconnexion** : « Se déconnecter » (menu de l'avatar) ferme la session de cet appareil uniquement ; « Se déconnecter de tous les appareils » (Compte et sécurité) révoque toutes les sessions. La suppression du compte efface aussi les photos de profil.
- **Retour des liens** : un lien expiré ou déjà utilisé, ou la première étape d'un changement d'email, affiche un message en haut de l'écran.
- **Export** : menu du compte (avatar) → Compte et sécurité → « Télécharger mes données » produit un fichier JSON (profil, objectifs, cibles quotidiennes, journal, pesées, aliments personnels).
- **Suppression** : menu du compte (avatar) → Compte et sécurité → « Supprimer définitivement mon compte » appelle la fonction SQL `delete_my_account()`, qui supprime l'utilisateur connecté ; toutes ses données sont effacées en cascade.

### Emails (SMTP et modèles en français)

Les emails d'inscription, de mot de passe oublié et de changement d'adresse sont envoyés par Supabase Auth. Le service d'envoi intégré de Supabase n'envoie qu'aux membres de l'organisation Supabase et seulement quelques emails par heure : pour les autres utilisateurs, il faut brancher un SMTP (Resend, Brevo…). Les modèles en français sont dans `supabase/templates/` ; la marche à suivre (SMTP, limites d'envoi, sujets, tests) est dans [docs/emails.md](docs/emails.md). Les erreurs de Supabase Auth sont affichées en français (`src/utils/authErrors.ts`).

## Paramètres d'affichage

Menu du compte (avatar) → Paramètres : thème (automatique, clair ou sombre — mémorisé sur l'appareil et dans le compte), calories du jour affichées « consommées / objectif » ou « restantes », macros en grammes ou en % de l'objectif, noms et visibilité des repas (un repas masqué n'est plus proposé à la saisie, les aliments déjà saisis restent affichés). Les choix sont enregistrés dans `user_preferences` ; sans ligne, les valeurs par défaut s'appliquent.

## Rappels (notifications push)

Paramètres → Rappels : rappel de pesée (si aucune pesée ce jour-là) et rappel du journal (si le dîner n'est pas noté), à l'heure choisie, sur les appareils où les notifications sont activées. À la première activation des notifications, les deux rappels sont programmés automatiquement (pesée 08:00, journal 20:30, ou les heures déjà cochées) ; les heures restent modifiables. Sur iPhone / iPad, l'application doit d'abord être installée sur l'écran d'accueil.

Fonctionnement :

1. Le navigateur s'abonne (Web Push) avec la clé publique VAPID fournie par l'Edge Function `send-reminders`, puis l'abonnement est enregistré (`save_push_subscription`).
2. Toutes les 15 minutes, `pg_cron` appelle l'Edge Function avec un secret partagé (Vault). Elle récupère les rappels dus (`claim_due_reminders`, selon le fuseau horaire de l'utilisateur, un envoi par jour au maximum), chiffre et envoie les notifications, et supprime les abonnements expirés.
3. Le service worker (`public/sw.js`) affiche la notification ; un clic ouvre l'application.

Les clés VAPID sont générées par l'Edge Function à son premier appel et stockées dans Supabase Vault : aucune clé n'est dans le dépôt. Code de l'Edge Function : `supabase/functions/send-reminders/` (déployée avec `verify_jwt = false`, elle vérifie elle-même le secret de la tâche planifiée ou la session de l'utilisateur).

## Notes

- Le dataset `public/data/ciqual-min.json` permet un accès local à une base alimentaire minimale.
- Le projet est orienté mobile-first avec une interface compacte et lisible.
