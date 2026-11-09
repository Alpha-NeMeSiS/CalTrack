import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AboutPage } from './AboutPage';
import { AppFooter } from '../Layout/AppFooter';

describe('AppFooter', () => {
  it('affiche la version et ouvre chaque section', async () => {
    const onOpen = vi.fn();
    render(<AppFooter onOpen={onOpen} />);
    expect(screen.getByText(/CalTrack v1\.0\.0/)).toBeInTheDocument();

    const nav = screen.getByRole('navigation', { name: 'Informations sur l’application' });
    const user = userEvent.setup();
    await user.click(within(nav).getByRole('button', { name: 'À propos' }));
    await user.click(within(nav).getByRole('button', { name: 'Vos données' }));
    await user.click(within(nav).getByRole('button', { name: 'Sources' }));
    expect(onOpen.mock.calls).toEqual([['app'], ['data'], ['sources']]);
  });

  it('cite les sources nutritionnelles sur demande', () => {
    const { rerender } = render(<AppFooter onOpen={vi.fn()} />);
    expect(screen.queryByText(/Données nutritionnelles/)).not.toBeInTheDocument();
    rerender(<AppFooter onOpen={vi.fn()} showAttribution />);
    expect(screen.getByText('Données nutritionnelles : Ciqual (ANSES), Open Food Facts (ODbL)')).toBeInTheDocument();
  });
});

describe('AboutPage', () => {
  // scrollIntoView n'existe pas dans jsdom : on note l'id de l'élément ciblé
  const scrolledTo: string[] = [];
  afterEach(() => {
    scrolledTo.length = 0;
    // @ts-expect-error nettoyage du simulacre (absent de jsdom)
    delete Element.prototype.scrollIntoView;
  });

  it('présente l’app, la santé, les données et les sources', () => {
    render(<AboutPage signedIn={false} />);
    expect(screen.getByRole('heading', { level: 1, name: 'À propos' })).toBeInTheDocument();
    for (const title of ['CalTrack', 'Santé', 'Vos données', 'Sources']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
    expect(screen.getByText('Version 1.0.0 · projet personnel')).toBeInTheDocument();
    expect(screen.getByText(/pas un dispositif médical/)).toBeInTheDocument();
    expect(screen.getByText(/serveurs à Paris/)).toBeInTheDocument();

    const ciqual = screen.getByRole('link', { name: /table Ciqual de l’ANSES/ });
    expect(ciqual).toHaveAttribute('href', 'https://ciqual.anses.fr');
    expect(ciqual).toHaveAttribute('target', '_blank');
    expect(ciqual).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: /Open Food Facts/ })).toHaveAttribute('href', 'https://world.openfoodfacts.org');
    expect(screen.getByText(/Licence Ouverte 2\.0/)).toBeInTheDocument();
    expect(screen.getByText(/licence ODbL/)).toBeInTheDocument();
  });

  it('propose l’export et la suppression seulement une fois connecté', async () => {
    const onOpenAccount = vi.fn();
    const { rerender } = render(<AboutPage signedIn={false} />);
    expect(screen.queryByRole('button', { name: 'Télécharger mes données' })).not.toBeInTheDocument();

    rerender(<AboutPage signedIn onOpenAccount={onOpenAccount} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Télécharger mes données' }));
    await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    expect(onOpenAccount).toHaveBeenCalledTimes(2);
  });

  it('revient à la connexion', async () => {
    const onBack = vi.fn();
    render(<AboutPage signedIn={false} onBack={onBack} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retour à la connexion' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('fait défiler jusqu’à la section demandée, même si elle change', () => {
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledTo.push(this.id);
    };
    const { rerender } = render(<AboutPage signedIn={false} section="sources" />);
    expect(scrolledTo[scrolledTo.length - 1]).toBe('about-sources');

    rerender(<AboutPage signedIn={false} section="data" />);
    expect(scrolledTo[scrolledTo.length - 1]).toBe('about-data');

    // Même section redemandée (nouveau clic) : défilement relancé
    const count = scrolledTo.length;
    rerender(<AboutPage signedIn={false} section="data" scrollKey={2} />);
    expect(scrolledTo).toHaveLength(count + 1);
  });

  it('ouvre la première section en haut de page, titre visible', () => {
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledTo.push(this.id);
    };
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<AboutPage signedIn={false} section="app" />);
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    expect(scrolledTo).toEqual([]);
    scrollTo.mockRestore();
  });
});
