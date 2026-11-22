// Visite guidée du journal : étapes (textes de la spec) et placement de la bulle.

export type TourTarget = 'calories' | 'add' | 'water' | 'weight' | 'nav';

export interface TourStep {
  /** Cible : élément visible portant data-tour="<id>" */
  id: TourTarget;
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'calories',
    title: 'Votre journée en un coup d’œil',
    body: 'L’anneau compare les calories mangées à votre objectif du jour. Juste dessous : protéines, lipides, glucides et fibres. Tout se met à jour à chaque aliment noté.',
  },
  {
    id: 'add',
    title: 'Noter ce que vous mangez',
    body: 'Touchez + pour chercher un aliment, scanner un code-barres, ou reprendre un favori ou une recette. Choisissez ensuite la quantité et le repas.',
  },
  {
    id: 'water',
    title: 'Votre eau',
    body: 'Un verre : + 250 ml. Une bouteille : + 500 ml. L’objectif est calculé d’après votre poids ; vous pouvez le changer dans Paramètres.',
  },
  {
    id: 'weight',
    title: 'Votre pesée',
    body: 'Notez votre poids ici, de préférence le matin. Vos pesées font avancer l’objectif et servent à ajuster vos calories.',
  },
  {
    id: 'nav',
    title: 'Aller plus loin',
    body: 'Tendances : vos moyennes et votre historique. Objectif : votre progression. Profil, Paramètres et ce guide sont dans le menu de votre avatar, en haut à droite.',
  },
];

/** Découpe autour de la cible (px) */
export const TOUR_HOLE_PADDING = 6;
/** Écart entre la découpe et la bulle (px) */
export const TOUR_GAP = 12;
/** Marge minimale aux bords de l'écran (px) */
export const TOUR_MARGIN = 16;
/** Position du haut de la cible après défilement (px, sous l'en-tête) */
export const TOUR_SCROLL_TOP = 120;
/** Largeur de la bulle sur ordinateur (px) */
export const TOUR_BUBBLE_WIDTH = 360;
/** En dessous de cette largeur, la bulle prend toute la largeur (px) */
export const TOUR_MOBILE_MAX = 640;

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Position fixe de la bulle : top ou bottom, left et width */
export interface BubblePlacement {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

/**
 * Bulle sous la cible si la place suffit, sinon au-dessus, sinon en bas de
 * l'écran (à bottomInset du bord : au-dessus de la barre d'onglets sur mobile).
 */
export function placeBubble(
  target: Rect,
  bubbleHeight: number,
  viewport: { width: number; height: number },
  opts: { bottomInset: number }
): BubblePlacement {
  const mobile = viewport.width < TOUR_MOBILE_MAX;
  const width = mobile ? viewport.width - 2 * TOUR_MARGIN : TOUR_BUBBLE_WIDTH;
  const left = mobile
    ? TOUR_MARGIN
    : Math.max(TOUR_MARGIN, Math.min(target.left, viewport.width - TOUR_MARGIN - TOUR_BUBBLE_WIDTH));

  const needed = bubbleHeight + TOUR_GAP + TOUR_MARGIN;
  const holeBottom = target.top + target.height + TOUR_HOLE_PADDING;
  const holeTop = target.top - TOUR_HOLE_PADDING;

  if (viewport.height - holeBottom >= needed) {
    return { top: holeBottom + TOUR_GAP, left, width };
  }
  if (holeTop >= needed) {
    return { bottom: viewport.height - holeTop + TOUR_GAP, left, width };
  }
  return { bottom: opts.bottomInset, left, width };
}
