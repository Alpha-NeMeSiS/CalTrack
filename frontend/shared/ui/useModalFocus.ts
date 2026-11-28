// Accessibilité commune aux fenêtres modales (audit A-05).
//
// Le motif ARIA « dialog » exige que le focus reste à l'intérieur de la
// fenêtre : sans cela, la touche Tab emmène l'utilisateur sur les boutons de la
// page derrière, qu'un lecteur d'écran est pourtant censé ignorer (aria-modal).
// axe ne détecte pas ce défaut, car il ne simule pas la navigation au clavier.
//
// Ce hook regroupe les quatre comportements attendus :
//   1. Tab et Maj+Tab tournent à l'intérieur de la fenêtre ;
//   2. Échap ferme la fenêtre ;
//   3. le focus revient à l'élément qui l'a ouverte à la fermeture ;
//   4. la page derrière ne défile plus.
import { RefObject, useEffect, useRef } from 'react';

/**
 * Éléments réellement atteignables au clavier. Deux pièges évités ici :
 *   - les anciennes versions ne regardaient que les `<button>` : un lien ou un
 *     champ ajouté plus tard s'échappait du piège ;
 *   - `tabindex="-1"` doit être exclu partout, y compris sur un `<button>`.
 *     Les onglets de la fenêtre d'ajout utilisent ce motif (« roving
 *     tabindex ») : seul l'onglet actif appartient à l'ordre de tabulation.
 */
const FOCUSABLE_SELECTOR = ['a[href]', 'button', 'input', 'select', 'textarea', '[tabindex]']
  .map((selector) => `${selector}:not([disabled]):not([tabindex="-1"]):not([hidden])`)
  .join(', ');

/**
 * Écarte les éléments masqués. On ne peut pas se fier à `offsetParent` : jsdom
 * ne calcule aucune mise en page et le renvoie toujours à null, ce qui viderait
 * la liste dans les tests.
 */
function isVisible(element: HTMLElement): boolean {
  if (element.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return !style || (style.display !== 'none' && style.visibility !== 'hidden');
}

export interface UseModalFocusOptions {
  /**
   * false pour laisser Échap sans effet (par exemple pendant un
   * enregistrement, pour ne pas fermer la fenêtre au milieu).
   */
  closeOnEscape?: boolean;
  /**
   * false pour laisser la page défiler. Indispensable à la visite guidée, qui
   * fait défiler la page jusqu'à chaque élément qu'elle met en avant.
   */
  lockScroll?: boolean;
}

export function useModalFocus(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  { closeOnEscape = true, lockScroll = true }: UseModalFocusOptions = {}
) {
  // Les options sont lues à chaque touche, mais l'effet ne doit PAS se
  // réexécuter : son nettoyage rend le focus à l'ouvrant, ce qui le volerait à
  // chaque rendu si `onClose` change d'identité (cas d'une fonction en ligne).
  const handlers = useRef({ onClose, closeOnEscape });
  handlers.current = { onClose, closeOnEscape };
  // lockScroll est lu une seule fois, au montage : le verrou est posé et retiré
  // par l'effet lui-même.
  const lockScrollRef = useRef(lockScroll);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const locksScroll = lockScrollRef.current;
    const previousOverflow = document.body.style.overflow;
    if (locksScroll) document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!handlers.current.closeOnEscape) return;
        event.preventDefault();
        handlers.current.onClose();
        return;
      }

      if (event.key !== 'Tab' || !containerRef.current) return;

      const items = Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(isVisible);
      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Focus hors de la fenêtre (clic sur l'arrière-plan) : on le ramène
      if (active && !containerRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (locksScroll) document.body.style.overflow = previousOverflow;
      // L'ouvrant peut avoir disparu entre-temps (bouton démonté) : focus()
      // n'existe alors plus, d'où l'appel optionnel.
      opener?.focus?.();
    };
    // containerRef est une ref stable ; onClose et closeOnEscape passent par
    // `handlers` pour que cet effet ne tourne qu'au montage et au démontage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
