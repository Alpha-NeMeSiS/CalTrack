// Visite guidée : fond assombri avec une découpe autour de l'élément montré,
// et une bulle (dialogue) avec Passer / Précédent / Suivant / Terminer.
// Les cibles sont les éléments visibles portant data-tour="<id>".
import { KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BubblePlacement,
  findTourTarget,
  placeBubble,
  Rect,
  TOUR_HOLE_PADDING,
  TOUR_MOBILE_MAX,
  TOUR_SCROLL_TOP,
  TourStep,
} from '../../utils/tour';

export type TourFinishReason = 'done' | 'skipped';

interface GuidedTourProps {
  steps: readonly TourStep[];
  onFinish: (reason: TourFinishReason) => void;
}

/** La cible, ou l'un de ses parents, est fixe (bouton flottant, barre d'onglets) */
function isFixed(element: HTMLElement): boolean {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (window.getComputedStyle(node).position === 'fixed') return true;
  }
  return false;
}

const prefersReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

const toRect = (rect: DOMRect): Rect => ({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });

export function GuidedTour({ steps, onFinish }: GuidedTourProps) {
  // Étapes dont la cible est présente au démarrage (les autres sont sautées)
  const [available] = useState(() => steps.filter((step) => findTourTarget(step.id)));
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<BubblePlacement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const finishedRef = useRef(false);

  const finish = useCallback(
    (reason: TourFinishReason) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      onFinish(reason);
    },
    [onFinish]
  );

  // Aucune cible : rien à montrer
  useEffect(() => {
    if (available.length === 0) finish('skipped');
  }, [available.length, finish]);

  const step = available[index];

  const measure = useCallback(() => {
    if (!step) return;
    const target = findTourTarget(step.id);
    if (!target) return;
    const rect = toRect(target.getBoundingClientRect());
    setHole(rect);
    const bubbleHeight = bubbleRef.current?.offsetHeight || 220;
    setPlacement(
      placeBubble(rect, bubbleHeight, { width: window.innerWidth, height: window.innerHeight }, {
        bottomInset: window.innerWidth < TOUR_MOBILE_MAX ? 88 : 16,
      })
    );
  }, [step]);

  // Nouvelle étape : la cible du flux défile sous l'en-tête, puis on mesure
  useLayoutEffect(() => {
    if (!step) return;
    const target = findTourTarget(step.id);
    if (target && !isFixed(target)) {
      const top = target.getBoundingClientRect().top;
      window.scrollBy?.({ top: top - TOUR_SCROLL_TOP, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    measure();
    const frame = window.requestAnimationFrame?.(measure);
    primaryRef.current?.focus();
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame?.(frame);
    };
  }, [step, measure]);

  // Rotation, redimensionnement ou défilement : la bulle suit la cible
  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  // Échap = passer, où que soit le focus
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish('skipped');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [finish]);

  if (!step) return null;

  const isLast = index === available.length - 1;
  const titleId = 'guided-tour-title';
  const bodyId = 'guided-tour-body';

  // Tab reste dans la bulle
  const trapFocus = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !bubbleRef.current) return;
    const buttons = Array.from(bubbleRef.current.querySelectorAll<HTMLButtonElement>('button'));
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      {/* La page dessous n'est pas cliquable pendant la visite */}
      <div className="absolute inset-0" aria-hidden="true" />
      {hole && (
        <div
          data-testid="tour-hole"
          aria-hidden="true"
          className="pointer-events-none fixed rounded-[18px] ring-2 ring-primary-600"
          style={{
            top: `${hole.top - TOUR_HOLE_PADDING}px`,
            left: `${hole.left - TOUR_HOLE_PADDING}px`,
            width: `${hole.width + 2 * TOUR_HOLE_PADDING}px`,
            height: `${hole.height + 2 * TOUR_HOLE_PADDING}px`,
            boxShadow: '0 0 0 9999px rgb(2 6 23 / 0.62)',
          }}
        />
      )}
      <div
        ref={bubbleRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={trapFocus}
        className="panel fixed space-y-2 overflow-y-auto p-4"
        style={{
          maxHeight: 'calc(100vh - 32px)',
          ...(placement
            ? {
                left: `${placement.left}px`,
                width: `${placement.width}px`,
                ...(placement.top !== undefined ? { top: `${placement.top}px` } : { bottom: `${placement.bottom}px` }),
              }
            : { left: '16px', right: '16px', bottom: '16px' }),
        }}
      >
        <p className="section-label">
          Étape {index + 1} sur {available.length}
        </p>
        <h2 id={titleId} className="card-title">
          {step.title}
        </h2>
        <p id={bodyId} className="text-sm text-body">
          {step.body}
        </p>
        <div className="flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => finish('skipped')}
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            Passer
          </button>
          <div className="flex gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex((current) => current - 1)}
                className="rounded-md btn-secondary bg-surface px-3 py-1.5 text-sm"
              >
                Précédent
              </button>
            )}
            <button
              ref={primaryRef}
              type="button"
              onClick={() => (isLast ? finish('done') : setIndex((current) => current + 1))}
              className="btn-brand text-sm"
            >
              {isLast ? 'Terminer' : 'Suivant'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
