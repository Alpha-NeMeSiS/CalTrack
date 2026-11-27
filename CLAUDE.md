# CalTrack : consignes pour les agents

**Commence par lire [`docs/CONTEXTE-AGENT.md`](docs/CONTEXTE-AGENT.md)** : projet,
façon de travailler, état actuel, ce qui reste à faire et pièges connus.
Mets-le à jour à la fin de ta session.

L'essentiel :

- Réponds **en français**, simplement : l'utilisateur est développeur junior
  fullstack (web et IA).
- Travaille sur `dev` et ouvre une **PR brouillon** vers `main`. L'utilisateur
  fusionne lui-même. Vérifie qu'une PR est vraiment fusionnée avant d'agir.
- Nouvelle fonctionnalité : brainstorming → spec → validation → plan → TDD.
  « code » veut dire « saute la relecture du plan ».
- Avant de pousser : `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, `npm run test:a11y -- --trace off`.
- Aucun secret dans le dépôt, jamais de force-push, pas de déploiement en
  production sans accord. Changer la version de `package.json` déclenche un
  déploiement Netlify payant en crédits.
- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
