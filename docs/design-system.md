# Design system de CalTrack

Ce guide décrit les couleurs, les composants et les règles d'interface. Objectif : un code lisible (on nomme ce qu'une couleur **fait**, pas sa teinte), un texte lisible pour tout le monde (contrastes WCAG 2.2 AA en clair et en sombre) et des garde-fous automatiques pour que ça le reste.

## Couleurs par rôle

Toutes les couleurs sont définies dans [`theme.palette.js`](../theme.palette.js), en clair et en sombre. Tailwind les lit via des variables CSS (`rgb(var(--c-…))`) : une classe comme `text-muted` s'adapte toute seule au thème, sans `dark:`.

### Couleurs simples

| Rôle | Classe | Usage |
| --- | --- | --- |
| Surface | `bg-surface` | Cartes, fenêtres, champs |
| Surface atténuée | `bg-surface-muted` | Survol, lignes de liste, zones secondaires |
| Surface creusée | `bg-surface-sunken` | Pastille neutre, fond de barre de progression |
| Surface marquée | `bg-surface-strong` | Élément inactif bien visible |
| Ligne discrète / normale / forte / appuyée | `border-line-subtle`, `border-line`, `border-line-strong`, `border-line-emphasis` | Séparateurs, bordures de cartes, bordures de champs, contours appuyés |
| Encre | `text-ink` | Titres de contenu, chiffres importants |
| Corps | `text-body` | Texte courant, libellés de champs |
| Atténué | `text-muted` | Texte secondaire |
| Discret | `text-subtle` | Indications, unités, dates |
| Sur couleur | `text-on-color` | Texte ou icône posé sur une couleur pleine (blanc en clair, encre en sombre) |

### Familles (nuances 50 à 900)

| Famille | Teinte | Usage |
| --- | --- | --- |
| `brand` | vert du logo | Identité : bouton de marque, bouton flottant « Ajouter », courbes |
| `accent` | orange | Titres (`h1`–`h4`), onglet actif |
| `primary` | bleu | Action principale d'un formulaire (`btn-primary`), focus |
| `info` | bleu | Information, journée en cours, progression temporelle |
| `success` | vert | Objectif atteint, confirmation |
| `warning` | ambre | Avertissement, retard sur le rythme |
| `danger` | rouge | Erreur, suppression, dépassement |
| `orange` | orange | Donnée « en dessous de l'objectif » (graphiques, tendances) |

`primary` et `info` sont aujourd'hui tous deux bleus mais ne sont pas interchangeables : `primary` désigne une **action**, `info` un **état**. On pourra changer la couleur des boutons sans toucher aux messages d'information.

### Anciens noms

| Avant | Maintenant |
| --- | --- |
| `kaizen-*` | `brand-*` |
| `shonen-*` | `accent-*` |
| `btn-kaizen`, `card-kaizen` | `btn-brand`, `card-glass` |
| `text-gray-900` / `800` | `text-ink` |
| `text-gray-700` | `text-body` |
| `text-gray-600` | `text-muted` |
| `text-gray-500` / `400` | `text-subtle` |
| `bg-white` | `bg-surface` (`text-white` → `text-on-color`) |
| `bg-gray-50` / `100` / `200` | `bg-surface-muted` / `bg-surface-sunken` / `bg-surface-strong` |
| `border-gray-100` / `200` / `300` / `400` | `border-line-subtle` / `border-line` / `border-line-strong` / `border-line-emphasis` |
| `red-*`, `green-*`, `amber-*` / `yellow-*` | `danger-*`, `success-*`, `warning-*` |
| `blue-*` | `primary-*` (action) ou `info-*` (état) |

## Règles de contraste

Les paires ci-dessous atteignent 4,5:1 (texte) ou 3:1 (icônes) dans les deux thèmes ; elles sont vérifiées par `src/test/paletteContrast.test.ts`.

- **Texte d'état sur fond teinté** : nuance `-700` sur `-50` ou `-100` (`text-danger-700` sur `bg-danger-50`). Pour `warning` : `-800`.
- **Texte blanc** (`text-on-color`) : seulement sur `primary-600` et plus, `danger-600` et plus, `brand-700` et plus.
- **Vert du logo** (`brand-500`, `brand-400`) : décoration et graphiques uniquement, jamais sous du texte. Une icône blanche demande au moins `brand-600`.
- **Orange vif** (`accent-500`) : jamais pour du texte ; utiliser `accent-700`.
- **Indications** : `text-subtle`, lisible même sur les lignes teintées des tendances.
- **Bouton désactivé** : nuance `-300` (`disabled:bg-primary-300`), pour qu'il ne ressemble pas à un bouton actif.

## Composants

Les composants React sont dans [`src/components/ui/`](../src/components/ui). Ils s'appuient sur les classes de `src/index.css` (couche `components`), qu'on peut aussi utiliser directement.

### Button

```tsx
import { Button } from '../ui/Button';

<Button onClick={save}>Enregistrer</Button>
<Button variant="secondary" size="sm">Annuler</Button>
<Button variant="danger" type="submit">Supprimer</Button>
```

| Propriété | Valeurs | Défaut |
| --- | --- | --- |
| `variant` | `primary`, `secondary`, `danger`, `brand`, `ghost` | `primary` |
| `size` | `sm`, `md`, `lg` | `md` |
| `type` | attribut HTML | `button` (pas d'envoi de formulaire par accident) |

Toutes les autres propriétés d'un `<button>` sont transmises. Anneau de focus visible au clavier, curseur interdit et teinte claire quand le bouton est désactivé.

### Card

```tsx
<Card as="section" aria-labelledby="titre">…</Card>
```

`as` : `div` (défaut), `section` ou `article`. `padded={false}` retire la marge intérieure. Classe équivalente : `panel`.

### Badge

```tsx
<Badge tone="success">Objectif atteint</Badge>
```

`tone` : `success`, `warning`, `danger`, `info`, `neutral` (défaut). Classes équivalentes : `badge badge-success`…

### Field

```tsx
<Field label="Poids (kg)" hint="Le matin, à jeun" error={errors.weight} inputMode="decimal" />
```

Relie automatiquement le libellé, l'aide et l'erreur au champ (`htmlFor`, `aria-describedby`, `aria-invalid`) : un lecteur d'écran annonce l'erreur puis l'aide. Classes équivalentes : `field-label`, `field-input`.

## Nombres

Toujours passer par [`src/utils/format.ts`](../src/utils/format.ts), jamais par `toFixed()` qui affiche « 1.5 » :

| Fonction | Exemple |
| --- | --- |
| `formatNumber(1.5, 1)` | `1,5` (décimales fixes, espace fine entre les milliers) |
| `formatDecimal(80)` | `80` (décimales inutiles retirées) |
| `formatSigned(-3, 1)` | `−3,0` (vrai signe moins, pas de signe pour zéro) |
| `formatKg(80.25)` | `80,3 kg` |
| `formatPercent(50)` | `50 %` |

## Garde-fous automatiques

| Vérification | Commande | Ce qu'elle bloque |
| --- | --- | --- |
| `src/test/designTokens.test.ts` | `npm test` | Une teinte brute (`text-gray-500`, `bg-white`, `bg-red-50`…) ou un ancien nom (`kaizen`, `shonen`) dans `src/` |
| `src/test/paletteContrast.test.ts` | `npm test` | Une modification de palette qui ferait passer une paire de couleurs sous le seuil AA |
| `e2e/accessibility.spec.ts` | `npm run test:a11y` | Tout défaut WCAG 2.2 A/AA détecté par axe (contraste, libellés, rôles, clavier) sur les écrans principaux, mobile et ordinateur, clair et sombre |

Le contrôle d'accessibilité tourne sur le build de production avec un Supabase simulé (`e2e/fixtures/supabase.ts`) : aucune clé ni connexion n'est nécessaire. En local, il faut Chromium (`npx playwright install chromium`). Les exceptions assumées sont listées en tête du test, chacune limitée à une règle et un élément, avec sa justification.
