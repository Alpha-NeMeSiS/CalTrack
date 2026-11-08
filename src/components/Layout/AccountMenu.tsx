// Menu du compte (en haut à droite) : avatar → Mon profil, Compte et sécurité,
// Paramètres, Se déconnecter.
// - Ordinateur : liste déroulante sous le bouton.
// - Mobile : panneau qui monte du bas de l'écran (plus facile à atteindre au pouce).
// Le menu est rendu dans <body> (portail) : l'en-tête crée un contexte
// d'empilement (sticky + flou) qui le ferait passer sous la barre d'onglets.
// Accessibilité : motif « menu bouton » (aria-haspopup, flèches, Échap, Tab).
import { CSSProperties, KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, LogOut, Settings, ShieldCheck, User } from 'lucide-react';
import type { AppView } from '../../utils/navigation';
import { getDisplayName, IdentityLike } from '../../utils/avatar';
import { Avatar } from '../Profile/Avatar';

interface AccountMenuProps {
  /** Identité affichée : photo, prénom et nom (facultatifs), email */
  identity: IdentityLike & { profile_picture_url?: string | null };
  onNavigate: (view: Extract<AppView, 'profile' | 'account' | 'settings'>) => void;
  onSignOut: () => void;
}

/** Options du menu, dans l'ordre */
const getMenuItems = (menu: HTMLElement | null) =>
  Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

export function AccountMenu({ identity, onNavigate, onSignOut }: AccountMenuProps) {
  const displayName = getDisplayName(identity);
  const hasName = displayName !== identity.email;
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  // Position de la liste déroulante (ordinateur), recalculée si la fenêtre change
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);

  // À l'ouverture, le focus va sur la première option
  useEffect(() => {
    if (open) getMenuItems(menuRef.current)[0]?.focus();
  }, [open]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = getMenuItems(menuRef.current);
    const index = list.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => list[(i + list.length) % list.length]?.focus();

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(list.length - 1);
        break;
    }
  };

  const choose = (action: () => void) => {
    close(false);
    action();
  };

  const itemClass =
    'flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none sm:py-2';

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Menu du compte (${displayName})`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex min-h-[44px] items-center gap-2 rounded-full p-1 text-sm text-gray-700 hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-kaizen-500 sm:pr-3"
      >
        <Avatar identity={identity} className="h-9 w-9 text-sm" />
        <span className="hidden max-w-[16rem] truncate sm:inline">{displayName}</span>
        <ChevronDown className="hidden h-4 w-4 text-gray-500 sm:block" aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <>
            {/* Fond : un clic en dehors du menu le ferme (assombri sur mobile) */}
            <div className="fixed inset-0 z-40 bg-black/30 sm:bg-transparent" aria-hidden="true" onClick={() => close()} />
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label="Compte"
              onKeyDown={handleMenuKeyDown}
              style={{ '--menu-top': `${position.top}px`, '--menu-right': `${position.right}px` } as CSSProperties}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white p-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-xl sm:inset-x-auto sm:bottom-auto sm:right-[var(--menu-right)] sm:top-[var(--menu-top)] sm:w-64 sm:rounded-lg sm:border sm:border-gray-200 sm:pb-2"
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300 sm:hidden" aria-hidden="true" />
              <div className="px-3 py-2" role="none">
                <p className="text-xs text-gray-500">Connecté en tant que</p>
                <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                {hasName && <p className="truncate text-xs text-gray-500">{identity.email}</p>}
              </div>
              <div className="my-1 border-t border-gray-100" role="none" />
              <button type="button" role="menuitem" className={itemClass} onClick={() => choose(() => onNavigate('profile'))}>
                <User className="h-4 w-4 text-gray-500" aria-hidden="true" />
                Mon profil
              </button>
              <button type="button" role="menuitem" className={itemClass} onClick={() => choose(() => onNavigate('account'))}>
                <ShieldCheck className="h-4 w-4 text-gray-500" aria-hidden="true" />
                Compte et sécurité
              </button>
              <button type="button" role="menuitem" className={itemClass} onClick={() => choose(() => onNavigate('settings'))}>
                <Settings className="h-4 w-4 text-gray-500" aria-hidden="true" />
                Paramètres
              </button>
              <div className="my-1 border-t border-gray-100" role="none" />
              <button type="button" role="menuitem" className={itemClass} onClick={() => choose(onSignOut)}>
                <LogOut className="h-4 w-4 text-gray-500" aria-hidden="true" />
                Se déconnecter
              </button>
            </div>
          </>,
          document.body
        )}
    </>
  );
}
