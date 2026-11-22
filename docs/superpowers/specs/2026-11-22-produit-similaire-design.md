# Produit scanné sans valeurs : estimation d'après des produits proches — spec

Date : 22 novembre 2026 · Statut : à valider · Version visée : **2.2.0**

## Intention

Quand un produit scanné existe dans Open Food Facts mais sans valeurs nutritionnelles, CalTrack propose les valeurs **les plus proches possible du vrai produit**, trouvées parmi des produits similaires d'Open Food Facts : d'abord la même marque, puis les autres marques. L'utilisateur garde la main : il vérifie, corrige ou saisit l'étiquette. Rien n'est ajouté sans sa validation.

### Objectifs

- Après le scan d'un produit sans valeurs, une estimation pour 100 g s'affiche sans clic de plus.
- L'estimation privilégie le produit le plus proche (même marque, même recette) plutôt qu'une moyenne large.
- On peut choisir un autre produit proche dans une liste.
- Les valeurs pré-remplissent le formulaire existant (« Saisie manuelle »). Le produit est enregistré dans « Mes aliments » avec son code-barres.
- Un aliment enregistré avec des valeurs estimées porte un badge « Estimé » tant que ses valeurs n'ont pas été corrigées.

### Hors champ

- Pas d'estimation pour un code-barres inconnu d'Open Food Facts (sans nom, rien à comparer).
- Pas d'estimation dans la recherche par nom : elle ne montre déjà que des produits avec valeurs.
- Pas d'envoi des valeurs vers Open Food Facts.
- Pas d'équivalent Ciqual (approche C écartée).
- Pas d'écran de modification des aliments personnels en dehors du formulaire existant.

### À éviter (échec même si « ça marche »)

- Ajouter au journal des valeurs estimées sans que l'utilisateur les ait vues.
- Présenter une estimation comme les valeurs de l'étiquette (pas de badge, pas de bandeau).
- Bloquer le scan ou l'ajout pendant la recherche de produits proches.
- Afficher des produits sans rapport (pizza pour des pâtes) ou des fiches incohérentes.

### Décisions prises avec l'utilisateur

| Sujet | Décision |
| --- | --- |
| Objectif | « Valeur la plus proche du vrai produit » |
| Approche | A : estimation automatique + liste de produits proches au choix |
| Maquette | Validée (carte « Estimation pour 100 g », badge de proximité, deux boutons, liste dépliable, formulaire pré-rempli avec bandeau) |
| Badge « Estimé » | Oui, dans « Mes aliments », la recherche et l'aliment sélectionné (colonne en base) |

## Approches envisagées

| Approche | Compromis | Choix |
| --- | --- | --- |
| A. Produits Open Food Facts proches (marque puis toutes marques), classés par mots du nom en commun | Proche du vrai produit (essai PastaBox : 123 kcal estimés pour 127 réels), deux recherches en plus | **Retenue** |
| B. Liste seule, sans estimation | Simple, mais l'utilisateur juge seul à chaque fois | Écartée |
| C. Équivalent générique Ciqual | Sans réseau, mais ignore la marque et la recette | Écartée |

## Recherche des produits proches

### Données du produit scanné

- `fetchOFFProduct` renvoie déjà le nom, la marque et la portion (`serving_size`) pour un produit sans valeurs.
- Le cas `no_nutrition` transporte en plus : `code`, `brand?` (marques jointes par « , ») et `servingGrams?`.

### Mots du nom

`nameTokens(name, brand)`, dans `src/lib/similarProducts.ts` :

1. Le nom est mis en minuscules, sans accents, découpé sur tout ce qui n'est pas une lettre ou un chiffre.
2. On retire :
   - les mots de moins de 3 caractères ;
   - les mots vides `les des aux avec pour sans une sur par the and with` ;
   - les mots de la marque ;
   - les quantités (`330g`, `1kg`, `500`, `25cl`…).
3. On retire le « s » final des mots de plus de 4 lettres.
4. On garde au plus 6 mots, dans l'ordre.

Exemple : « Sodebo pastabox 330g fusilli a la bolognaise » (marque Sodebo) donne `pastabox fusilli bolognaise`.

Sans aucun mot, on ne cherche rien et le message actuel s'affiche (avec « Créer cet aliment »).

### Requêtes

Deux recherches en parallèle via le proxy existant `/api/off/search`. Le proxy accepte un nouveau paramètre `size` : entier de 1 à 30, 10 par défaut ; une valeur invalide donne 10.

| Recherche | Requête (`q`) | Taille |
| --- | --- | --- |
| Même marque (si une marque est connue) | `brands:"<première marque>" <mots>` | 30 |
| Toutes marques | `<mots>` | 30 |

- La première marque est mise en minuscules, en gardant les accents. Les guillemets et barres obliques inverses sont supprimés (`brands:"côté snack"` fonctionne, `"cote snack"` ne trouve rien).
- Les mots ne contiennent que `[a-z0-9]`, donc aucun caractère spécial ne passe dans la requête.
- Une recherche en échec est ignorée si l'autre répond.
- Une nouvelle saisie, un nouveau scan ou la fermeture de la fenêtre annule les recherches (`AbortController` du scan).

## Classement et estimation

`rankSimilarProducts(target, candidates)` puis `estimateFromSimilar(ranked)`, fonctions pures testées dans `src/lib/similarProducts.ts`.

### Produits retenus

Un produit trouvé est **retenu** s'il remplit toutes ces conditions :

- son code est différent du produit scanné ;
- `kcal_per_100g > 0` ;
- il est cohérent : |kcal − (4 × protéines + 4 × glucides + 9 × lipides)| ≤ max(20, 20 % des kcal). Les fiches mal saisies sont écartées ;
- il a au moins un mot du nom en commun avec le produit scanné.

Les doublons (même nom normalisé et mêmes kcal arrondies) ne sont gardés qu'une fois : le premier rencontré, avec la recherche « même marque » en premier.

### Score

- **Mots en commun** = part des mots du produit scanné présents dans le nom du produit trouvé. Ce nom passe par la même normalisation, et on y ajoute les mots accolés deux à deux pour que « Pasta Box » corresponde à « pastabox ».
- **Score** = mots en commun + 0,25 si une marque du produit trouvé est la première marque du produit scanné (comparaison sans casse ni accents).
- Tri par score décroissant. À égalité, l'ordre de la recherche est conservé (même marque d'abord).

### Estimation

- **Produits utilisés** : ceux qui ont le meilleur score (à 0,01 près), 3 au plus.
- Valeurs pour 100 g :
  - 1 produit : ses valeurs ;
  - 2 produits : la moyenne ;
  - 3 produits : la médiane de chaque valeur (kcal, protéines, lipides, glucides, fibres).
- Arrondis : kcal à l'unité, macros et fibres au dixième.
- **Proximité** : « Même marque » si tous les produits utilisés sont de la même marque que le produit scanné, sinon « Autres marques ».
- **Liste « Ou choisir un produit proche »** : les 5 premiers produits retenus, produits utilisés compris.
- Sans produit retenu, il n'y a pas d'estimation.

Essai réel (PastaBox bolognaise Sodebo, étiquette : 127 kcal, P 7,5, L 2,8, G 17) :

- produit utilisé : « Pasta Box fusilli à la bolognaise » (Sodebo, score 1,25) ;
- estimation : **123 kcal, P 6,7, L 3, G 16** ;
- liste : 4 autres PastaBox fusilli (carbonara, napolitaine, fromages, jambon champignons).

Ce jeu de données (réduit) sert de test.

## Interface

### Après le scan (onglet Recherche, « Produits supermarché »)

1. Le message devient : « « {nom} » est dans Open Food Facts, mais sans valeurs nutritionnelles. »
2. Pendant la recherche, une ligne « Recherche de produits similaires… » s'affiche (`role="status"`).
3. **Avec estimation** : une carte (`panel`, `section` titrée) contient :
   - le titre « Estimation pour 100 g » (`section-label`) et un sous-titre selon le nombre de produits utilisés : « D'après le produit le plus proche », « Moyenne des 2 produits les plus proches » ou « Médiane des 3 produits les plus proches » ;
   - le badge de proximité : « Même marque » (`badge-success`) ou « Autres marques » (`badge-info`) ;
   - « ≈ {kcal} kcal », puis « Protéines {p} g · Lipides {l} g · Glucides {g} g » ;
   - une ligne de source : le nom et la marque du produit le plus proche si un seul est utilisé, sinon les marques (2 au plus), puis « À vérifier avec l'étiquette si vous l'avez. » ;
   - les boutons « Utiliser l'estimation » (`btn-primary`) et « Saisir l'étiquette » (`btn-secondary`). Ce dernier ouvre le formulaire vide, comme le « Créer cet aliment » actuel ;
   - « Ou choisir un produit proche ({n}) », fermé par défaut (`aria-expanded`). Chaque ligne affiche nom, marque, kcal et macros, avec un bouton « Utiliser » (`aria-label` « Utiliser les valeurs de « {nom} » »).
4. **Sans estimation** (aucun produit retenu, ou recherches en échec) : « Aucun produit similaire trouvé : créez-le avec les valeurs de l'étiquette. » et le bouton « Créer cet aliment ».
5. Les récents et favoris restent masqués tant que le message est affiché (comportement actuel).

### Formulaire pré-rempli (onglet Saisie manuelle)

- Le brouillon passé à `onCreateFood` devient `{ barcode, name?, servingGrams?, estimate? }`.
  - `estimate` contient `{ values: { kcal_per_100g, protein_g, fat_g, carbs_g, fiber_g }, source }`.
  - `source` est le texte du bandeau, après « d'après » : « 1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo) », « 3 produits proches (Sodebo) »…
- Remplis : nom, quantité (`servingGrams`, sinon 100), valeurs « 100 g (étiquette) », « Enregistrer dans mes aliments » coché, code-barres.
- **Bandeau** (avertissement, `warning`), à la place du bandeau vert : « **Valeurs estimées** d'après {source}. Corrigez-les avec l'étiquette si vous l'avez. Le produit sera enregistré dans vos aliments et reconnu au prochain scan. »
- « Utiliser » sur un produit de la liste remplit ses valeurs, avec la source « 1 produit proche : {nom} ({marque}) ».

### Badge « Estimé »

- Badge `badge-warning` « Estimé » dans :
  - la liste « Mes aliments » ;
  - les résultats de recherche (aliments personnels) ;
  - l'aliment sélectionné (par exemple au prochain scan du même code-barres).
- Sur l'aliment sélectionné estimé, un bouton « Corriger avec l'étiquette » ouvre le formulaire pré-rempli avec ses valeurs, son code-barres et le bandeau « Valeurs estimées : remplacez-les par celles de l'étiquette. ».
- **Règle d'enregistrement** : l'aliment est enregistré comme estimé si le formulaire venait d'une estimation **et** si les cinq valeurs pour 100 g enregistrées sont exactement celles pré-remplies, avec la base « 100 g » inchangée. Une seule valeur modifiée enlève le badge.

## Données

- Migration `foods_values_estimated` : `ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS values_estimated boolean NOT NULL DEFAULT false;`
  - RLS et politiques existantes inchangées.
  - L'export des données (`select *`) inclut la colonne.
- Type `Food.values_estimated?: boolean`, puis `NormalizedFood.estimated?: boolean` (via `personalFoodToNormalized`).
- `buildPersonalFoodPayload(userId, values, barcode, estimated = false)` écrit `values_estimated`. `savePersonalFood` transmet le drapeau ; la mise à jour par code-barres l'écrase aussi.
- Test SQL `supabase/tests/10_foods_values_estimated.sql` :
  - valeur par défaut `false` ;
  - le propriétaire peut passer la colonne à `true` ;
  - la ligne d'un autre utilisateur n'est pas modifiable.

## Textes et version

- Version **2.2.0** (nouvelle fonctionnalité) : `package.json`, `CHANGELOG.md`, README (version actuelle, migrations, tests BDD).
- `RELEASES` (« Quoi de neuf ? ») :
  - « Produit scanné sans valeurs : CalTrack propose une estimation d'après les produits les plus proches, à vérifier avec l'étiquette. »
  - « Les aliments enregistrés avec des valeurs estimées portent le badge « Estimé ». »
- Guide, section « Noter un repas » : ajout de « Un produit scanné n'a pas de valeurs ? CalTrack propose une estimation d'après des produits proches : vérifiez-la avec l'étiquette. »

## Tests

- **Unitaires** (`similarProducts.test.ts`) :
  - mots du nom (marque, quantités, mots vides, pluriels, accents) ;
  - mots accolés (« Pasta Box ») ;
  - cohérence kcal / macros ;
  - exclusion du produit scanné ;
  - doublons ;
  - score et bonus de marque ;
  - produits utilisés 1/2/3 ;
  - médiane et moyenne ;
  - proximité ;
  - liste de 5 ;
  - jeu réel PastaBox → 123 / 6,7 / 3 / 16.
- **Proxy** (`netlify/tests/off-search.test.ts`) : `size` (défaut, bornes, valeur invalide).
- **Client OFF** : `no_nutrition` avec `code`, `brand`, `servingGrams` ; recherche avec `size`.
- **FoodSearch** :
  - chargement ;
  - carte d'estimation ;
  - liste dépliable ;
  - « Utiliser » ;
  - aucun produit ;
  - échec réseau ;
  - annulation par un nouveau scan ;
  - badge « Estimé » dans les résultats.
- **AddEntryModal** :
  - pré-remplissage et bandeau ;
  - drapeau estimé enregistré (valeurs inchangées) ou non (une valeur modifiée) ;
  - « Corriger avec l'étiquette » ;
  - badge dans « Mes aliments ».
- **Services et utilitaires** : `values_estimated` dans le payload, conversion vers `NormalizedFood`.
- **BDD** : test 10.
- **E2E accessibilité** : scan d'un produit sans valeurs (API simulées), carte d'estimation dépliée, formulaire pré-rempli, axe sans violation, sur mobile et ordinateur.

## Risques

| Risque | Parade |
| --- | --- |
| Open Food Facts lent | Ligne « Recherche de produits similaires… », recherches annulables, saisie manuelle toujours possible |
| Fiches Open Food Facts fausses | Filtre de cohérence kcal / macros, badge « Estimé », bandeau, liste pour choisir |
| Produits sans rapport | Au moins un mot du nom en commun, marque privilégiée |
| Estimation prise pour la réalité | « ≈ », « Estimation », bandeau d'avertissement, badge persistant jusqu'à correction |
