import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card } from './Card';
import { Field } from './Field';

describe('Button', () => {
  it('applique la variante et la taille, et garde les props du bouton', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="danger" size="sm" onClick={onClick} className="w-full">
        Supprimer
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Supprimer' });
    expect(button).toHaveClass('btn-danger', 'px-3', 'py-1.5', 'text-sm', 'w-full');
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.setup().click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it('bouton principal par défaut, envoi de formulaire possible', () => {
    render(<Button type="submit">Enregistrer</Button>);
    const button = screen.getByRole('button', { name: 'Enregistrer' });
    expect(button).toHaveClass('btn-primary');
    expect(button).toHaveAttribute('type', 'submit');
  });
});

describe('Card', () => {
  it('carte avec marge intérieure, en section titrée', () => {
    render(
      <Card as="section" aria-label="Résumé">
        Contenu
      </Card>
    );
    expect(screen.getByRole('region', { name: 'Résumé' })).toHaveClass('panel', 'p-4', 'sm:p-6');
  });
});

describe('Badge', () => {
  it('pastille selon le ton', () => {
    render(<Badge tone="success">À l’objectif</Badge>);
    expect(screen.getByText('À l’objectif')).toHaveClass('badge', 'badge-success');
  });
});

describe('Field', () => {
  it('relie le libellé, l’aide et l’erreur au champ', () => {
    render(<Field label="Poids (kg)" hint="Le matin, à jeun" error="Valeur invalide" defaultValue="80" />);
    const input = screen.getByLabelText('Poids (kg)');
    expect(input).toHaveClass('field-input');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Valeur invalide Le matin, à jeun');
  });
});
