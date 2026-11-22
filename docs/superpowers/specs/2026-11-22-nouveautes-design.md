# Fenêtre « Quoi de neuf ? » — spec

Date : 22 novembre 2026 · Statut : à valider

Complète la spec de la visite guidée et du Guide (`docs/superpowers/specs/2026-11-09-guide-design.md`). Les deux sont livrés ensemble, en version **2.1.0**.

## Intention

À chaque nouvelle version de CalTrack, même un simple correctif, l'utilisateur voit au lancement de l'app ce qui a changé, **une seule fois par version** et sur tous ses appareils. Il découvre les nouveautés sans lire le CHANGELOG, qui reste un document technique.

### Objectifs

- Une fenêtre « Quoi de neuf ? » au lancement quand la version de l'app est plus récente que la dernière vue sur le compte.
- Les versions manquées regroupées dans une seule fenêtre.
- Des textes courts, écrits pour l'utilisateur, sans jargon.
- Impossible de publier une version sans ses notes : un test le bloque.

### Hors champ

- Pas d'écran d'administration ni de notes en base de données.
- Pas de notification push pour les mises à jour.
- Pas de fenêtre sur l'écran de connexion.
- Pas de traduction.

### À éviter (échec même si « ça marche »)

- Deux fenêtres d'affilée au lancement (visite guidée puis « Quoi de neuf ? »).
- Une fenêtre qui revient à chaque lancement.
- Du jargon (« migrations », « build », numéros de PR) dans la fenêtre.

### Décisions prises avec l'utilisateur

| Sujet | Décision |
| --- | --- |
| Déclencheur | Chaque nouvelle version, y compris les correctifs |
| Mémorisation | Par compte, en base (colonne `user_preferences.last_seen_version`) |
| Livraison | Avec la visite guidée et le Guide, en version 2.1.0 |
| Source des textes | Un fichier de notes dans le code, vérifié par un test |
| Maquette | Validée (titre, sous-titre, versions avec date, points, « C'est noté ») |

## Approches envisagées

| Approche | Compromis | Choix |
| --- | --- | --- |
| Fichier de notes `src/data/releases.ts`, vérifié par un test | Deux endroits à mettre à jour (notes et CHANGELOG), mais l'oubli est bloqué par le test | **Retenue** |
| Lecture du CHANGELOG au build | Une seule source, mais du jargon développeur à l'écran et un découpage du Markdown fragile | Écartée |
| Notes en base (table Supabase) | Modifiables sans déploiement, mais SQL ou écran d'administration à chaque version | Écartée |

## Notes de version (`src/data/releases.ts`)

- `interface ReleaseNote { version: string; date: string; items: string[] }`.
  - `version` : au format `MAJEUR.MINEUR.CORRECTIF` (ex. `2.1.0`).
  - `date` : au format ISO `AAAA-MM-JJ`, la date de mise en ligne.
  - `items` : 1 à 5 phrases courtes, sans jargon.
- `RELEASES: readonly ReleaseNote[]` : de la plus récente à la plus ancienne. La première entrée a la version de `package.json` (`APP_VERSION`).
- Notes initiales :

| Version | Date | Points |
| --- | --- | --- |
| 2.1.0 | date de mise en ligne, renseignée dans la PR | « Visite guidée : 5 bulles pour découvrir le journal, à relancer quand vous voulez depuis le Guide. » · « Nouvelle page « Guide » : le fonctionnement de l’app, pas à pas. » · « Cette fenêtre vous présente maintenant chaque mise à jour. » |
| 2.0.0 | 2026-11-22 | « Nouveau look : couleur verte, nouvelle police et thème sombre. » · « Scanner de code-barres pour retrouver un produit en un instant. » · « Favoris, récents, « Mes aliments » et recettes maison en parts. » · « Suivi de l’eau, des pesées et de la composition corporelle. » · « Ajout de plusieurs aliments à la suite, rappels et application installable. » |

- **Utilitaires** (`src/utils/releases.ts`) :
  - `compareVersions(a: string, b: string): number` compare numériquement chaque partie, donc `2.0.10` est plus récent que `2.0.9`. Une version mal formée est considérée comme `0.0.0`.
  - `unseenReleases(releases, lastSeen: string | null): ReleaseNote[]` :
    - avec `lastSeen`, renvoie les versions strictement plus récentes que lui ;
    - avec `null` ou une valeur invalide, renvoie seulement la première entrée (cas de secours, voir plus bas).
- **Garde-fous** (tests) :
  - `RELEASES[0].version === APP_VERSION` ;
  - versions uniques et triées de la plus récente à la plus ancienne ;
  - dates au format ISO ;
  - entre 1 et 5 points par version, aucun vide.

## Fenêtre (`src/components/WhatsNew/WhatsNewDialog.tsx`)

`WhatsNewDialog({ releases: ReleaseNote[]; onClose: () => void; subtitle?: string })`

- **Rendu** : fenêtre centrée sur fond assombri, sur le même modèle que « Ajouter un aliment » (`bg-surface rounded-lg shadow-xl`, `max-w-md`, `max-h-[90vh]` avec défilement interne).
- **Contenu** :
  - **Titre** « Quoi de neuf ? » (`card-title`, `<h2>`).
  - **Sous-titre** (`text-xs text-subtle`) :
    - par défaut, « CalTrack a été mis à jour » pour une version et « N mises à jour depuis votre dernière visite » pour plusieurs ;
    - `subtitle` remplace ce texte (utilisé depuis « À propos »).
  - **Une section par version** :
    - en-tête « Version 2.1.0 · 3 décembre 2026 » (`section-label`, date en français, via l'utilitaire de date existant) ;
    - liste à puces des points (`text-sm text-body`) ;
    - un séparateur entre les versions.
  - **Boutons** : « C'est noté » (bouton principal, à droite) et une croix « Fermer ».
- **Accessibilité** :
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` sur le titre ;
  - focus sur « C'est noté » à l'ouverture ;
  - Tab reste dans la fenêtre ;
  - Échap ferme.
- **Fermeture** : « C'est noté », la croix et Échap appellent tous `onClose`. Un clic sur le fond ne ferme pas, pour éviter une fermeture involontaire sur mobile.

## Mémorisation et démarrage

- **Base** : migration `last_seen_version text` (nullable) dans `user_preferences`, dans la même migration que `tour_completed_at`. Les règles RLS de la table s'appliquent, et l'export RGPD l'inclut déjà.
- **Préférences** :
  - `UserPreferences.lastSeenVersion: string | null` (défaut `null`), lu par `preferencesFromRow` ;
  - `preferencesToRow` n'écrit ni `last_seen_version` ni `tour_completed_at` : un enregistrement des Paramètres ne peut jamais les effacer.
- **Services** (`src/services/preferences.ts`), en upsert sur `user_id` des seules colonnes citées :
  - `markVersionSeen(userId, version)` écrit `last_seen_version` ;
  - `markTourCompleted(userId, version, now?)` écrit `tour_completed_at` **et** `last_seen_version` d'un coup. Cette signature remplace celle de la spec du Guide (`markTourCompleted(userId, now?)`).
- **Contexte** :
  - `markVersionSeen(version): Promise<void>` ;
  - `markTourCompleted()` passe `APP_VERSION` ;
  - les deux mettent à jour les préférences locales.
- **Ordre au lancement** (`App.tsx`, connecté avec profil, préférences `ready`) :
  1. **Visite guidée** si `tourCompletedAt` est vide (règles de la spec du Guide). À la fin, la version actuelle est marquée vue : un nouvel inscrit, et un compte existant qui découvre la visite, ne voient pas « Quoi de neuf ? » pour cette version.
  2. **Sinon, « Quoi de neuf ? »** si `lastSeenVersion` est vide, invalide, ou plus ancien que `APP_VERSION`. Elle montre `unseenReleases(RELEASES, lastSeenVersion)`. À la fermeture : `markVersionSeen(APP_VERSION)`.
  3. **Jamais** les deux dans la même session.
  4. Préférences en chargement ou en erreur : ni visite ni fenêtre.
- **Où** : la fenêtre s'affiche au-dessus de la vue en cours (en général le journal au lancement). Elle ne dépend pas du contenu du journal.
- **Échec d'enregistrement** :
  - noté dans la console, sans rien afficher ;
  - la fenêtre se ferme et ne revient pas pendant la session ;
  - elle reviendra au prochain lancement.
- **`lastSeenVersion` vide alors que la visite est déjà vue** (cas de secours, par exemple un enregistrement en partie raté) : la fenêtre montre seulement la version actuelle.

## La revoir

- Page « À propos », section « CalTrack » : un bouton secondaire « Voir les nouveautés ».
- Il ouvre `WhatsNewDialog` avec **toutes** les versions de `RELEASES` et le sous-titre « Historique des mises à jour ».
- Il fonctionne connecté ou non, et n'enregistre rien.

## Version 2.1.0

- `package.json` passe en `2.1.0`.
- CHANGELOG : entrée `2.1.0` (visite guidée, page Guide, fenêtre « Quoi de neuf ? »).
- README : la section Version rappelle d'ajouter les notes dans `src/data/releases.ts`.

## Tests

- **`releases`** :
  - `compareVersions` : `2.0.10` plus récent que `2.0.9`, `2.1.0` plus récent que `2.0.10`, égalité, version mal formée ;
  - `unseenReleases` : depuis `2.0.0` avec les notes 2.1.0, 2.0.1 et 2.0.0, renvoie `[2.1.0, 2.0.1]` ; depuis la version actuelle, renvoie `[]` ; avec `null`, renvoie seulement la première ;
  - les garde-fous de `RELEASES`.
- **`WhatsNewDialog`** :
  - une version : sous-titre « CalTrack a été mis à jour » ; deux versions : « 2 mises à jour depuis votre dernière visite » ;
  - en-têtes « Version … · date en français » et points affichés ;
  - focus sur « C'est noté » ;
  - « C'est noté », la croix et Échap appellent `onClose` ; un clic sur le fond ne l'appelle pas.
- **Préférences** :
  - `lastSeenVersion` est lu ;
  - `preferencesToRow` n'écrit pas `last_seen_version` ;
  - `markVersionSeen` et `markTourCompleted` envoient exactement les colonnes prévues.
- **`App`, démarrage** :
  - visite non vue : la visite s'affiche, pas la fenêtre ; à la fin, `last_seen_version` est la version actuelle et la fenêtre n'apparaît pas ;
  - visite vue et `lastSeenVersion = '2.0.0'` : la fenêtre montre 2.1.0 ; « C'est noté » appelle `markVersionSeen('2.1.0')` et la fenêtre ne revient pas ;
  - visite vue et `lastSeenVersion = APP_VERSION` : pas de fenêtre ;
  - préférences en erreur : rien.
- **« À propos »** : « Voir les nouveautés » ouvre la fenêtre avec toutes les versions, connecté ou non.
- **Base** (`09_tour.sql`, renommé `09_tour_and_version.sql`) : `last_seen_version` est vide par défaut ; un utilisateur remplit la sienne, pas celle d'un autre.
- **e2e** :
  - le Supabase simulé renvoie par défaut visite vue et `last_seen_version` égale à la version actuelle, pour que les tests existants ne soient pas gênés ;
  - un test dédié avec `last_seen_version: '2.0.0'` : fenêtre visible, axe en clair et en sombre, sur mobile et ordinateur, puis « C'est noté » et écriture reçue ;
  - « Voir les nouveautés » depuis « À propos » : axe.
