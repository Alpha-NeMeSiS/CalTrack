# Journal des versions

Toutes les évolutions notables de CalTrack. Les numéros suivent le
[versionnage sémantique](https://semver.org/lang/fr/) :

- **majeur** (2.0.0) : refonte ou changement important de l'application ;
- **mineur** (2.1.0) : nouvelle fonctionnalité ;
- **correctif** (2.0.1) : correction sans nouveauté.

La version affichée dans l'app (pied de page, page « À propos ») est lue dans `package.json`.

## [2.2.3] — 28 novembre 2026

Correctifs issus de l'audit complet du code : [docs/AUDIT-2026-11-27.md](docs/AUDIT-2026-11-27.md).

### Corrections

- **Plancher calorique** (A-01) : le seuil de sécurité (jamais sous le métabolisme de base, ni sous 1 200 kcal pour une femme / 1 500 pour un homme) n'était appliqué qu'aux objectifs de perte. Après l'acceptation d'un ajustement des calories, un changement de profil pouvait faire tomber un objectif de maintien ou de prise à moins de 1 000 kcal/jour. Il s'applique désormais à tous les types d'objectif.
- **Macros** (A-15) : leur somme pouvait dépasser la cible calorique (cas trouvés par un test de balayage, à des âges élevés avec protéines à 2,5 g/kg). La règle « 25 % des calories en lipides » cède d'abord, puis les protéines, jamais le minimum de lipides lié au poids. Le drapeau `macros_reduced_to_fit` signale la réduction.
- **Aliment personnel avec code-barres** (A-09) : un double appui sur « Enregistrer » pouvait afficher une erreur Postgres brute. Un seul `upsert` remplace « lire puis insérer ».
- **Suppression du compte** (A-26) : un échec de suppression des photos était ignoré, laissant un fichier sans propriétaire. La suppression s'arrête maintenant, avec un message exact.
- **Onboarding** : l'erreur de création du compte n'était pas annoncée aux lecteurs d'écran (`role="alert"` manquant).

### Sécurité

- **Photos de profil** (A-02) : le seau de stockage était public et sa politique de lecture n'avait aucune restriction (photos lisibles et listables sans être connecté). Le code enregistre le chemin du fichier et l'affiche par une URL signée d'une heure. La migration qui rend le seau privé convertit les photos existantes : personne n'a à les renvoyer.
- **En-têtes HTTP** (A-07) : Content-Security-Policy (vérifiée sur la prévisualisation : aucune violation), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS. L'empreinte du script en ligne de `index.html` est contrôlée par un test.
- **Proxy Open Food Facts** (A-10) : limite de 30 requêtes par minute et par adresse sur `/api/off/*`. La syntaxe avancée de l'index n'est plus acceptée que si l'application la demande (A-28).
- **Abonnements push** (A-18) : l'adresse doit appartenir à un service de push de navigateur.

### Accessibilité

- **Fenêtres** (A-05) : la fenêtre d'ajout d'aliment laissait le focus s'échapper vers la page derrière. Nouveau hook `useModalFocus` (piège de focus, Échap, retour du focus, page figée), appliqué aux trois fenêtres.
- **Contrôle statique** (A-22) : `eslint-plugin-jsx-a11y`, qui a trouvé 15 problèmes invisibles pour axe, dont 6 libellés qui n'étiquetaient rien.

### Performance

- **Chargement** (A-12) : les écrans secondaires sont téléchargés à la demande. Fichier principal : 550 → 448 ko (158 → 133 ko compressé).
- **Re-rendus** (A-20) : la valeur d'`AuthContext` est mémoïsée.
- **Service worker** (A-14) : les anciens fichiers de chaque déploiement sont purgés du cache.
- **Base de données** (A-04, A-16) : 24 politiques RLS évaluées une fois par requête au lieu d'une fois par ligne, une politique en double supprimée, deux clés étrangères indexées.

### Technique

- Garde-fou React (`AppErrorBoundary`, A-03) : une erreur affiche un message et un bouton de rechargement au lieu d'une page blanche.
- Table `password_reset_tokens`, jamais utilisée, supprimée (A-17).
- Node 22 figé pour Netlify (`.nvmrc`, `NODE_VERSION`, A-19). `.bolt/` supprimé (A-13). `.gitignore` couvre `.env.*` (A-24).
- `@netlify/blobs` est conservée : une extension Netlify installée sur le site en dépend (son retrait faisait échouer le build).
- Tests : 888 → 966 Vitest, couverture 90,71 % → 93,73 % (onboarding : 6 % → 93 %), 24 nouvelles vérifications SQL.

## [2.2.2] — 27 novembre 2026

### Corrections

- **Recherche Open Food Facts par nom**, cassée par un changement du service `search.openfoodfacts.org` (fin novembre 2026). Son index ne contient plus les valeurs nutritionnelles de la plupart des produits, il stocke les marques au format `xx:marque` et il combine les mots en ET. CalTrack écartait donc presque tous les résultats.
  - Le proxy `off-search` complète les valeurs manquantes depuis la fiche produit (10 au plus par recherche, gardées en mémoire 30 minutes pour ménager la limite de requêtes d'Open Food Facts).
  - Les marques sont nettoyées (`xx:ferrero` → « Ferrero »).
  - Chaque mot est cherché dans le nom **ou** la marque, et les petits mots (« de », « à »…) sont ignorés : « jus de pomme » donnait 0 résultat.
  - Depuis les serveurs de Netlify, Open Food Facts refuse parfois une partie de ces fiches (trop de requêtes). Un produit dont la fiche n'a pas pu être lue n'est donc plus écarté : il s'affiche avec « Valeurs chargées au choix ». Quand on le choisit, sa fiche est chargée comme après un scan (estimation d'après des produits similaires si elle n'a pas de valeurs). Exemple : « pastabox bolognaise ». Un produit dont la fiche est lue mais vide reste écarté.
  - Une fiche refusée (429, panne) n'est plus gardée en mémoire 30 minutes comme « sans valeurs » : la recherche suivante la redemande. Le refus est noté dans les journaux de la fonction.
- **Produits similaires** (2.2.0) : le filtre de marque cherche aussi les formes `xx:` de l'index, et les mots du nom sont reliés par OR.

## [2.2.1] — 23 novembre 2026

### Corrections

- **Boissons** : les portions du fabricant en volume (`ml`, `cl`, `l`) sont lues, avec 1 ml ≈ 1 g (jus, lait, sodas). Le bouton affiche « 1 portion (200 ml) ». Avant, seules les portions en grammes étaient proposées.
- **Open Food Facts** : les fonctions `off-product` et `off-search` réessaient une fois, après 300 ms, en cas de panne passagère (réponse 5xx ou 429, ou coupure réseau), avant d'afficher « indisponible ». Un produit inconnu (404) n'est pas réessayé.

### Technique

- Netlify : la production ne se construit qu'au changement de version de `package.json`, ou avec `[deploy]` dans le titre de la PR. C'est la règle `ignore` de `netlify.toml` (`backend/netlify/ignore-build.sh`, testée). Les prévisualisations de PR, gratuites, se construisent toujours. Objectif : économiser les crédits de l'offre gratuite (15 par déploiement en production).
- Code serveur regroupé dans `backend/` : `backend/supabase/` (migrations, tests de la base, Edge Function, modèles d'emails) et `backend/netlify/` (proxy Open Food Facts). Aucun changement pour l'utilisateur.
- App React déplacée de `src/` vers `frontend/`, rangée par fonctionnalité : `frontend/app/` (démarrage, navigation, contexts, mise en page), `frontend/features/<fonctionnalité>/` (écrans, règles métier `*.ts`, accès à la base `*.service.ts`, tests), `frontend/shared/` (composants de base, client Supabase, dates, format). Notes de version : `frontend/features/whats-new/releaseNotes.ts`. Aucun changement pour l'utilisateur.
- Documentation de l'architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (vue d'ensemble, dossiers, « où trouver quoi », trajet d'une donnée, ajouter une fonctionnalité).

## [2.2.0] — 22 novembre 2026

### Nouveautés

- **Produit scanné sans valeurs** : estimation pour 100 g d'après les produits Open Food Facts les plus proches (même marque d'abord, puis toutes marques, classés par mots du nom en commun), avec le badge de proximité, la liste des 5 produits proches au choix et la saisie de l'étiquette toujours possible. Les valeurs pré-remplissent la saisie manuelle avec un bandeau d'avertissement.
- **Badge « Estimé »** sur les aliments personnels enregistrés avec des valeurs estimées (« Mes aliments », recherche, aliment choisi), et bouton « Corriger avec l'étiquette ». Le badge disparaît dès qu'une valeur est corrigée.

### Technique

- Colonne `foods.values_estimated` (migration `20261122205300`, test BDD 10).
- Proxy `/api/off/search` : paramètre `size` (1 à 30 résultats, 10 par défaut).
- `src/lib/similarProducts.ts` : mots du nom, filtre de cohérence kcal / macros, score, estimation (produit le plus proche, moyenne de 2 ou médiane de 3).

## [2.1.1] — 22 novembre 2026

### Corrections

- **Journal** : la suppression d'une ligne se confirme dans la ligne (« Confirmer » / « Annuler »), au style de l'app, au lieu de la fenêtre du navigateur.
- **Accessibilité** : les boutons de confirmation de suppression (journal, « Mes aliments ») affichent « Confirmer », le début de leur nom pour les lecteurs d'écran (WCAG 2.5.3).
- **Notifications de rappel** : icône de badge dédiée (logo blanc sur fond transparent) ; Android affichait un carré blanc à la place du logo.

## [2.1.0] — 22 novembre 2026

### Nouveautés

- **Visite guidée** : 5 bulles au premier passage sur le journal (calories, ajout d'aliment, eau, pesée, navigation), une seule fois par compte, à relancer depuis le Guide.
- **Page « Guide »** : le fonctionnement de l'app pas à pas, accessible depuis le pied de page, le menu de l'avatar et l'écran de connexion.
- **Fenêtre « Quoi de neuf ? »** au lancement après chaque mise à jour, une fois par version et par compte (versions manquées regroupées) ; à revoir depuis « À propos ».

### Technique

- Colonnes `user_preferences.tour_completed_at` et `last_seen_version`.
- Notes de version pour l'utilisateur dans `src/data/releases.ts`, vérifiées par un test (impossible de publier une version sans notes).

## [2.0.0] — 22 novembre 2026

La V2 : nouvelle direction artistique, scanner de code-barres, et de nombreuses fonctionnalités.

### Direction artistique

- Nouveau look : vert comme couleur principale, police Inter, cartes et titres uniformes (#46).
- Couleurs par rôle, composants de base communs (boutons, cartes, champs) et contrastes WCAG AA vérifiés automatiquement (#45).
- Thème sombre (#37).
- Tableau de bord repensé pour le mobile, barre d'onglets avec libellés, statuts des journées (#33).

### Nouveautés

- **Scanner de code-barres** avec l'appareil photo (ou en tapant le code) : le produit est retrouvé dans Open Food Facts avec ses portions (#40).
- **Favoris, récents et « Mes aliments »** en haut de la recherche, ajoutables en un tap ; les produits saisis à la main sont reconnus au scan (#42).
- **Recettes** : plats maison en parts, ajoutés au journal à la part ou au poids (#47).
- **Suivi de l'eau** : carte du jour, objectif selon le poids, moyenne dans les tendances (#47).
- **Journal plus rapide** :
  - modifier une ligne, portions du fabricant, copier les repas de la veille (#34) ;
  - ajouter plusieurs aliments à la suite sans fermer la fenêtre (#50).
- **Pesées** : journal des pesées, composition corporelle (masse grasse, muscles…) et courbes (#34, #43).
- **Objectif et calories** :
  - garde-fous nutritionnels et règles de macros ;
  - passage en maintien à la fin de l'objectif ;
  - ajustement des calories proposé d'après la dépense réelle (#34, #43).
- **Profil** : prénom, nom, photo, mesures détaillées facultatives (#39, #41).
- **Compte** :
  - mot de passe oublié, changement d'email, déconnexion de tous les appareils ;
  - export et suppression des données, conformément au RGPD (#34, #36).
- **Navigation** : menu de l'avatar, onglet Objectif, pages Profil, Compte et sécurité, et Paramètres (#35, #36).
- **Paramètres** : thème, affichage des calories et des macros, noms des repas, objectif d'eau (#36, #47).
- **Rappels** de pesée et de journal par notifications push (#37, #38).
- **Application installable** sur le téléphone (PWA) et statistiques enrichies (#34).
- **Pied de page et page « À propos »** : version, avertissement santé, données enregistrées, sources (#48).
- Emails de l'application en français (#40).

### Corrections

- Open Food Facts : les produits qui n'ont que des valeurs « préparé » (plats à réchauffer…) ne sont plus déclarés « sans valeurs nutritionnelles » (#50).
- Cibles quotidiennes et dates (#26), poids de départ des objectifs (#30), build Netlify (#27), migrations alignées sur la base (#32).

### Technique

- Tests unitaires (Vitest) (#26), tests de la base de données (#44), tests d'accessibilité de bout en bout avec Playwright et axe (#45).
- Intégration continue GitHub : lint, types, tests et build à chaque PR (#34).

## [1.0.0] — 24 mars 2026

Première version :

- inscription et connexion, puis formulaire d'accueil (profil et objectif) ;
- journal du jour avec calories et macros ;
- objectifs de perte, maintien ou prise, avec calcul des cibles ;
- tendances hebdomadaires ;
- recherche d'aliments dans la table Ciqual et dans Open Food Facts (via une fonction Netlify) ;
- saisie manuelle et ajout rapide.
