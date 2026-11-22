import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InfoPage } from './InfoPage';

describe('InfoPage', () => {
  it('affiche le titre, l’intro, les actions et des sections repérées par leur préfixe', () => {
    render(
      <InfoPage
        title="Guide"
        intro="Les bases."
        idPrefix="guide"
        actions={<button type="button">Revoir la visite</button>}
        sections={[
          { id: 'start', title: 'Premiers pas', content: <p>Contenu 1</p> },
          { id: 'water', title: 'Eau', content: <p>Contenu 2</p> },
        ]}
      />
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Guide' })).toBeInTheDocument();
    expect(screen.getByText('Les bases.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revoir la visite' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Eau' }).closest('section')).toHaveAttribute('id', 'guide-water');
    expect(screen.getByRole('navigation', { name: 'Sections de la page' })).toHaveTextContent('Premiers pasEau');
  });
});
