# Suivi de l'eau — spec

Date : 8 novembre 2026 · Statut : à valider

## Objectif

Noter en un geste l'eau bue dans la journée et voir où on en est par rapport à un objectif qui suit le poids, avec un résumé sur 7 jours dans Tendances.

### Décisions prises avec l'utilisateur

| Sujet | Décision |
| --- | --- |
| Objectif | Automatique d'après le poids (30 ml/kg), modifiable à la main dans Paramètres |
| Saisie | Carte « Eau » du journal : + 250 ml, + 500 ml, « Autre… » (quantité libre), « Annuler le dernier » |
| Historique | La carte suit la date du journal ; tuile « Eau moyenne » dans les 7 derniers jours de Tendances |
| Stockage | Une ligne par prise d'eau (`water_logs`) ; objectif manuel dans les préférences |
| Hors périmètre | Rappels pour boire, eau dans le journal alimentaire |

## Données

Une migration Supabase.

### `water_logs`

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | `uuid` | clé, `gen_random_uuid()` |
| `user_id` | `uuid` | `profiles(id)`, `ON DELETE CASCADE` |
| `date` | `date` | jour de la prise d'eau (date du journal) |
| `amount_ml` | `integer` | 1 à 3 000 |
| `created_at` | `timestamptz` | `now()` ; ordre des prises (« Annuler le dernier ») |

- Index `(user_id, date)`.
- RLS : lecture, ajout et suppression limités à `user_id = auth.uid()`. Pas de modification : une prise d'eau s'annule.
- Supprimée avec le compte (cascade), exportée avec les données du compte (`src/services/account.ts`).

### Objectif manuel

`user_preferences.water_goal_ml integer` : `NULL` = automatique, sinon de 500 à 6 000 (contrainte `CHECK`).

## Calculs (`src/utils/water.ts`)

Fonctions pures.

| Fonction | Résultat |
| --- | --- |
| `autoWaterGoal(weightKg)` | `weightKg × 30` ml, arrondi aux 100 ml, borné entre 1 500 et 4 000 ; 2 000 si le poids est inconnu. 79 kg → 2 400 ; 40 kg → 1 500 ; 150 kg → 4 000 |
| `waterGoal(goalMl, weightKg)` | `goalMl` s'il est renseigné, sinon `autoWaterGoal(weightKg)` |
| `waterTotal(logs)` | somme des `amount_ml` |
| `waterProgress(totalMl, goalMl)` | `{ percent, barPercent, remainingMl, reached }` : `percent` arrondi à l'unité et pouvant dépasser 100, `barPercent` plafonné à 100, `remainingMl ≥ 0`, `reached = total ≥ objectif` |
| `lastWaterLog(logs)` | prise la plus récente (`created_at`), ou `undefined` |
| `weeklyWaterSummary(logs, goalMl, today)` | sur les 7 jours avant `today` : `{ averageMl, loggedDays, daysAtGoal }`. Moyenne sur les jours avec au moins une prise, arrondie aux 50 ml (`null` sans prise) ; jours atteignant l'objectif actuel |
| `formatLiters(ml)` | litres à la française, 2 décimales au plus : « 0,5 L », « 1,25 L », « 2,4 L » |
| `validateWaterAmount(ml)` | `null`, ou « Indiquez une quantité entre 1 et 3 000 ml. » |
| `validateWaterGoal(liters)` | `null`, ou « L'objectif doit être compris entre 0,5 et 6 L. » |

## Écrans

### Carte « Eau » (journal)

- Placée sous la carte des calories et des macros, au-dessus de « Journal du jour » ; suit la date choisie dans le journal.
- En-tête : goutte (icône `Droplet`, `info-600`), titre `card-title` « Eau », total et objectif (« 1,25 L / 2,4 L »).
- Barre de progression (`role="progressbar"`, `info-500`, `success-500` quand l'objectif est atteint), pourcentage et « Encore 1,15 L », ou « Objectif atteint · 108 % » quand c'est le cas.
- Boutons « + 250 ml » et « + 500 ml » (ajout immédiat), « Autre… » (champ « Quantité (ml) » avec « Ajouter » et « Annuler »).
- « Annuler le dernier (+ 500 ml) » quand le jour a au moins une prise.
- Boutons désactivés pendant un envoi (pas de double ajout).

### Paramètres

Section « Eau » de la page Paramètres :
- « Automatique : 2,4 L », avec le calcul « 30 ml par kg × 79 kg, suit vos pesées » ;
- « Personnalisé », avec un champ en litres (de 0,5 à 6, virgule acceptée).

Enregistrée avec les autres préférences (`waterGoalMl` dans `UserPreferences`).

### Tendances

Tuile « Eau moyenne » dans « Vos 7 derniers jours » (`InsightsPanel`) : « 2,1 L/j » et « 4/7 jours à l'objectif » ; « Aucune prise notée » sans données.

### Couleur

L'eau utilise la famille `info` comme une couleur de donnée : barre `info-500` et goutte `info-600`, toutes deux au moins à 3:1.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `supabase/migrations/<version>_water_logs.sql` | Table, RLS, colonne `water_goal_ml` |
| `src/lib/supabase.ts` | Type `WaterLog` |
| `src/utils/water.ts` | Calculs, formatage, validation |
| `src/utils/preferences.ts` | `waterGoalMl` (lecture et écriture de `water_goal_ml`) |
| `src/services/water.ts` | `fetchWaterLogs(userId, from, to)`, `addWaterLog(userId, date, amountMl)`, `deleteWaterLog(id)` |
| `src/components/Water/useWaterDay.ts` | Prises du jour, ajout, annulation, erreurs |
| `src/components/Water/WaterCard.tsx` | Carte du journal |
| `src/components/Settings/WaterGoalSection.tsx` | Réglage de l'objectif |
| `src/components/Dashboard/Dashboard.tsx` | Place la carte |
| `src/components/Stats/InsightsPanel.tsx`, `WeeklyTrends.tsx` | Tuile « Eau moyenne » (prises des 7 derniers jours) |
| `src/services/account.ts` | `water_logs` dans l'export |

## Erreurs

- Ajout ou annulation en échec : « L'eau n'a pas pu être enregistrée. Réessayez. » (`role="alert"`) ; le total reste celui de la base.
- Chargement en échec : message et « Réessayer ».
- Quantité ou objectif hors limites : message de validation, aucun envoi.

## Tests

- **Calculs** (`water.test.ts`) : objectif automatique (79 → 2 400, bornes, poids inconnu), objectif manuel prioritaire, total, progression (52 %, 108 %, barre plafonnée), dernière prise, résumé sur 7 jours (moyenne, jours à l'objectif, période sans aujourd'hui, aucune prise), litres, validations.
- **Carte** : + 250 ml et + 500 ml, « Autre… » (valide et invalide), « Annuler le dernier », objectif atteint, erreur d'ajout, date du journal.
- **Paramètres** : bascule automatique / personnalisé, valeur invalide refusée, enregistrement de `water_goal_ml`.
- **Préférences** : lecture et écriture de `water_goal_ml`.
- **Export** : `water_logs` inclus.
- **Base** (`supabase/tests/08_water.sql`) : RLS (isolation, pas de modification), `amount_ml` de 1 à 3 000, `water_goal_ml` de 500 à 6 000 ou `NULL`, cascade à la suppression du compte.
- **Accessibilité** : carte Eau (journal) et section Eau (Paramètres) dans le contrôle axe de la CI.

## Critères d'acceptation

- Ajouter 250 ml, 500 ml ou une quantité libre en un geste, et annuler la dernière prise.
- Objectif automatique de 2,4 L pour 79 kg, remplaçable par une valeur manuelle.
- Résumé sur 7 jours dans Tendances.
- Données isolées par compte, exportées et supprimées avec le compte.
- Tous les tests, le contrôle axe et les garde-fous du design system sont verts.
