import { describe, expect, it, vi } from 'vitest';
import { isAboutSection, isAppView, isGuideSection, NAVIGATE_EVENT, navigateTo, NavigateEventDetail } from './navigation';
import { APP_VERSION } from './appInfo';

describe('navigation', () => {
  it('connaît la page « À propos » et ses sections', () => {
    expect(isAppView('about')).toBe(true);
    expect(isAppView('inconnue')).toBe(false);
    expect(isAboutSection('sources')).toBe(true);
    expect(isAboutSection('x')).toBe(false);
  });

  it('connaît la page « Guide » et ses sections', () => {
    expect(isAppView('guide')).toBe(true);
    expect(isGuideSection('install')).toBe(true);
    expect(isGuideSection('app')).toBe(false);
  });

  it('transmet la section demandée', () => {
    const listener = vi.fn();
    window.addEventListener(NAVIGATE_EVENT, listener);
    navigateTo('about', 'sources');
    navigateTo('account');
    window.removeEventListener(NAVIGATE_EVENT, listener);

    const details = listener.mock.calls.map(([event]) => (event as CustomEvent<NavigateEventDetail>).detail);
    expect(details).toEqual([{ view: 'about', section: 'sources' }, { view: 'account' }]);
  });
});

describe('appInfo', () => {
  it('lit la version de package.json : 2.1.1 (correctif confirmations et notifications)', () => {
    expect(APP_VERSION).toBe('2.1.1');
  });
});
