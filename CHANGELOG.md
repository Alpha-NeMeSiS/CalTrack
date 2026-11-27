# Journal des versions

Toutes les évolutions notables de CalTrack. Les numéros suivent le
[versionnage sémantique](https://semver.org/lang/fr/) :

- **majeur** (2.0.0) : refonte ou changement important de l'application ;
- **mineur** (2.1.0) : nouvelle fonctionnalité ;
- **correctif** (2.0.1) : correction sans nouveauté.

La version affichée dans l'app (pied de page, page « À propos ») est lue dans `package.json`.

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
