# Pied de page et page « À propos » — spec

Date : 9 novembre 2026 · Statut : à valider

## Objectif

Donner accès, depuis toute l'app (y compris l'écran de connexion), aux informations sur CalTrack : version, avertissement santé, données enregistrées et sources des données (attribution exigée par les licences Ciqual et Open Food Facts).

### Décisions prises avec l'utilisateur

| Sujet | Décision |
| --- | --- |
| Public | Usage privé pour l'instant : page « À propos » (sans mentions légales complètes), à compléter si l'app devient publique |
| Emplacement | Pied de page discret sur tous les écrans et sous l'écran de connexion, liens vers une page « À propos » |
| Approche | Page intégrée à l'app (nouvelle vue), accessible aussi sans être connecté |
| Version | `package.json` passe à `1.0.0` ; la version affichée est lue depuis ce fichier |

## Pied de page (`src/components/Layout/AppFooter.tsx`)

- `<footer>` en petit texte `text-subtle`, centré, en fin de contenu (au-dessus de la barre d'onglets sur mobile, grâce au `pb-28` existant).
- Ligne 1 : « CalTrack v1.0.0 · À propos · Vos données · Sources ». Les trois liens sont des boutons stylés en liens, regroupés dans `<nav aria-label="Informations sur l’application">`.
- Ligne 2 (app connectée) : « Données nutritionnelles : Ciqual (ANSES), Open Food Facts (ODbL) ».
- Interface : `AppFooter({ onOpen(section: AboutSection) })` ; « À propos » → `'app'`, « Vos données » → `'data'`, « Sources » → `'sources'`.
- Affiché par `App.tsx` sous le contenu principal (connecté) et sous les formulaires de connexion et d'inscription.

## Page « À propos » (`src/components/About/AboutPage.tsx`)

- `AboutPage({ section?: AboutSection, onBack?: () => void, signedIn: boolean })`. Au montage et à chaque changement de `section`, la page fait défiler jusqu'à la section (`scrollIntoView`).
- Titre `page-title` « À propos ». Raccourcis vers les sections (`<nav aria-label="Sections de la page">`) : CalTrack, Santé, Vos données, Sources.
- `onBack` fourni (écran de connexion) : bouton « Retour à la connexion ».
- Sections (`<section>` avec `id` et titre `card-title`) :

| `AboutSection` | Titre | Contenu |
| --- | --- | --- |
| `app` | CalTrack | « Suivi calorique personnalisé : journal, objectifs, pesées, eau et recettes. » ; « Version 1.0.0 · projet personnel » |
| `health` | Santé | Encadré ambre (`warning-50`, texte `warning-900`) : estimations, pas un dispositif médical, avis d'un médecin ou d'un diététicien, en particulier pendant une grossesse, en cas de trouble du comportement alimentaire ou de maladie |
| `data` | Vos données | Ce qui est enregistré (compte : email, nom ; profil : âge, taille, poids, composition ; journal, pesées, eau, recettes, favoris, préférences, notifications) ; où (Supabase, serveurs à Paris, UE ; site servi par Netlify) ; qui y a accès (vous seul, ni publicité, ni pistage, ni revente) ; combien de temps (jusqu'à la suppression du compte). Si connecté : boutons « Télécharger mes données » et « Supprimer mon compte », qui ouvrent la page Compte et sécurité (aucune action directe) |
| `sources` | Sources | Aliments génériques : table Ciqual de l'ANSES, Licence Ouverte 2.0 (lien `https://ciqual.anses.fr`) ; produits du supermarché : Open Food Facts, base collaborative sous licence ODbL, des erreurs sont possibles (lien `https://world.openfoodfacts.org`) ; calculs : métabolisme de base Mifflin-St Jeor (ou Katch-McArdle avec la masse grasse), eau 30 ml par kg |

- Les liens externes s'ouvrent dans un nouvel onglet (`target="_blank" rel="noopener noreferrer"`) et le disent (« (nouvel onglet) » en texte masqué).

## Navigation

- `src/utils/navigation.ts` :
  - `AppView` gagne `'about'` ;
  - `type AboutSection = 'app' | 'health' | 'data' | 'sources'` ;
  - `NavigateEventDetail` gagne `section?: AboutSection` ;
  - `navigateTo(view, section?)`.
- `App.tsx`, connecté : vue `'about'` avec la section demandée. Sans connexion : état `aboutSection` ; quand il est renseigné, la page « À propos » remplace le formulaire, avec « Retour à la connexion ».

## Version

- `package.json` : `"version": "1.0.0"`.
- `vite.config.ts` : `define: { __APP_VERSION__: JSON.stringify(version) }` (lu depuis `package.json`) ; déclaration dans `src/vite-env.d.ts` ; `src/utils/appInfo.ts` exporte `APP_VERSION`.

## Tests

- `AppFooter` : version affichée, chaque lien appelle `onOpen` avec sa section.
- `AboutPage` :
  - les 4 sections et leurs titres ;
  - version ;
  - attributions Ciqual et Open Food Facts avec leurs licences ;
  - boutons du compte seulement si connecté ;
  - « Retour à la connexion » appelle `onBack` ;
  - défilement vers la section demandée (`scrollIntoView` appelé sur la bonne section).
- `navigation` : `isAppView('about')`, `navigateTo('about', 'sources')` transmet la section.
- `App` (écran de connexion) : pied de page visible, « Sources » ouvre la page à la section Sources, « Retour à la connexion » revient au formulaire.
- Accessibilité : page « À propos » connectée et depuis l'écran de connexion, dans le contrôle axe de la CI.

## Hors périmètre

Mentions légales et politique de confidentialité complètes (usage public), page de contact, notes de version.

## Critères d'acceptation

- Pied de page visible sur l'app et sur l'écran de connexion, avec la version 1.0.0.
- Chaque lien ouvre la page « À propos » à la bonne section, connecté ou non.
- Sources citées avec leurs licences ; avertissement santé ; résumé des données avec accès à l'export et à la suppression du compte.
- Tous les tests, le contrôle axe et les garde-fous du design system sont verts.
