# Ajouter plusieurs aliments à la suite — design court

Date : 17 novembre 2026 · Statut : validé par l'utilisateur

## Intention

Noter un repas de plusieurs aliments sans rouvrir « Ajouter un aliment » après chaque ajout. Aujourd'hui, la fenêtre se ferme dès qu'un ajout réussit (`submitEntry` appelle `onClose`).

## Approches envisagées

| Approche | Compromis | Choix |
| --- | --- | --- |
| La fenêtre reste ouverte après chaque ajout ; on la ferme avec la croix | Un geste de plus pour un ajout seul | **Retenue par l'utilisateur**, sans bouton « Terminé » ni compteur dans la fenêtre |
| Deux boutons « Ajouter » et « Ajouter et continuer » | Choisir à chaque ajout, boutons serrés sur mobile | Écartée |
| Case « Rester ouvert après l'ajout », mémorisée | Réglage peu visible | Écartée |

## Comportement

- **Bouton « Ajouter »** : inchangé. Après un ajout réussi, la fenêtre reste ouverte.
- **Fermeture** : la croix, Échap et le clic à côté de la fenêtre, qui existent déjà. Le compteur du journal derrière se met déjà à jour (rechargement après l'ajout).
- **Confirmation** en haut du formulaire, après chaque ajout réussi : « ✓ <aliment> ajouté · <repas> · <kcal> kcal », ou « ✓ <aliment> ajouté · <kcal> kcal » sans repas. *(Choix de Claude : pas de « au <repas> », faux pour « Collation » et pour les noms de repas personnalisés.)*
  - Elle est annoncée aux lecteurs d'écran (`role="status"`).
  - Elle est remplacée à l'ajout suivant, et effacée au changement d'onglet.
- **Après l'ajout, selon l'onglet** :
  - **Recherche** : l'aliment choisi est retiré, le champ de recherche est vidé et reprend le focus, et les favoris et récents réapparaissent.
  - **Ajout rapide** (favori ou récent) : même confirmation, la liste reste affichée.
  - **Saisie manuelle** : le formulaire est vidé (nom, quantité, valeurs, options « Mes aliments »).
  - **Mes aliments** : « Utiliser » ouvre déjà l'aliment dans l'onglet Recherche ; après l'ajout, on reste dans Recherche (voir plus haut).
  - **Recettes** : retour à la liste des recettes.
- **Repas gardé** *(choix de Claude, validé avec le design)* : le repas du dernier ajout est proposé pour l'aliment suivant, à la place du repas habituel de cet aliment. Ça vaut pour la recherche, la sélection d'un favori ou d'un récent pour ajuster la quantité, la saisie manuelle et la portion d'une recette. L'ajout rapide (favori, récent ou recette en un tap) garde le repas affiché sur sa ligne.
- **En cas d'erreur** : inchangé, le message s'affiche et la saisie est conservée.

## Hors champ

- **Récents** : la liste « Récents » n'est pas rafraîchie pendant que la fenêtre est ouverte *(choix de Claude)*.
- Pas de bouton « Terminé », pas de compteur dans la fenêtre.

## Tests

- La fenêtre reste ouverte après un ajout (recherche, ajout rapide, saisie manuelle, recette), avec la confirmation.
- Les champs sont remis à zéro, le repas est gardé, et la croix ferme la fenêtre.
- Une erreur garde la saisie.
- L'onglet Recettes revient à sa liste.
- Les tests actuels qui attendaient la fermeture sont mis à jour.
- Contrôle axe de la confirmation (e2e).
