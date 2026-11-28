// Tests du formulaire d'onboarding (audit A-06).
//
// C'est l'écran que traverse TOUT nouvel utilisateur, et celui qui crée le
// profil, la première pesée, l'objectif et la cible du jour — donc les données
// dont dépendent tous les calculs de l'application. Il n'était couvert ni par
// les tests unitaires (6,27 % des lignes) ni par les tests de bout en bout.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingForm } from './OnboardingForm';
import { getOperationArgs, hasOperation, QueryCall, supabaseMock } from '../../test/supabaseMock';

const refreshProfile = vi.fn();
const authValue = { user: { id: 'user-1', email: 'moi@example.com' }, refreshProfile };

vi.mock('../../app/contexts/useAuth', () => ({ useAuth: () => authValue }));

vi.mock('../../shared/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

function handler(call: QueryCall) {
  // `select().single()` après une écriture : renvoyer une ligne avec un id
  if (hasOperation(call, 'insert') || hasOperation(call, 'upsert') || hasOperation(call, 'update')) {
    return { data: { id: `${call.table}-1` }, error: null };
  }
  return { data: null, error: null };
}

beforeEach(() => {
  supabaseMock.reset();
  supabaseMock.setHandler(handler);
  refreshProfile.mockReset();
});

/** Remplit l'étape 1 avec un profil valide et passe à l'étape 2. */
async function fillStepOne(
  overrides: { naissance?: string; taille?: string; poids?: string; sexe?: 'Homme' | 'Femme' } = {}
) {
  const user = userEvent.setup();

  if (overrides.sexe === 'Femme') await user.click(screen.getByRole('button', { name: 'Femme' }));

  const naissance = screen.getByLabelText('Date de naissance');
  await user.clear(naissance);
  await user.type(naissance, overrides.naissance ?? '1995-06-15');

  const taille = screen.getByLabelText('Taille (cm)');
  await user.clear(taille);
  await user.type(taille, overrides.taille ?? '178');

  const poids = screen.getByLabelText('Poids (kg)');
  await user.clear(poids);
  await user.type(poids, overrides.poids ?? '80');

  return user;
}

describe('OnboardingForm : étape 1 (informations personnelles)', () => {
  it('affiche les champs du profil', () => {
    render(<OnboardingForm />);
    expect(screen.getByLabelText('Date de naissance')).toBeInTheDocument();
    expect(screen.getByLabelText('Taille (cm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Poids (kg)')).toBeInTheDocument();
    // Le groupe de boutons « Sexe » est nommé pour les lecteurs d'écran (audit A-22)
    expect(screen.getByRole('group', { name: 'Sexe' })).toBeInTheDocument();
  });

  it('ne permet pas de continuer sans date de naissance', () => {
    render(<OnboardingForm />);
    expect(screen.getByRole('button', { name: 'Suivant' })).toBeDisabled();
  });

  it('passe à l’étape 2 avec un profil valide', async () => {
    render(<OnboardingForm />);
    const user = await fillStepOne();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByRole('group', { name: 'Objectif' })).toBeInTheDocument();
  });

  it('refuse une taille hors limites et reste à l’étape 1', async () => {
    render(<OnboardingForm />);
    const user = await fillStepOne({ taille: '40' });
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/taille/i);
    // Toujours à l'étape 1 : l'objectif n'est pas affiché
    expect(screen.queryByRole('group', { name: 'Objectif' })).not.toBeInTheDocument();
  });

  it('refuse un poids hors limites', async () => {
    render(<OnboardingForm />);
    const user = await fillStepOne({ poids: '500' });
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/poids/i);
  });

  it('refuse un âge invraisemblable', async () => {
    render(<OnboardingForm />);
    const user = await fillStepOne({ naissance: '2024-01-01' });
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Objectif' })).not.toBeInTheDocument();
  });
});

describe('OnboardingForm : étape 2 (objectif)', () => {
  it('revient à l’étape 1 avec « Retour », en gardant les saisies', async () => {
    render(<OnboardingForm />);
    const user = await fillStepOne({ taille: '178' });
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(screen.getByRole('button', { name: 'Retour' }));

    expect(screen.getByLabelText('Taille (cm)')).toHaveValue(178);
  });

  it('propose le niveau d’activité et les trois types d’objectif', async () => {
    render(<OnboardingForm />);
    const user = await fillStepOne();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));

    expect(screen.getByLabelText("Niveau d'activité")).toBeInTheDocument();
    const groupe = screen.getByRole('group', { name: 'Objectif' });
    expect(groupe).toHaveTextContent('Perte de poids');
    expect(groupe).toHaveTextContent('Maintien');
    expect(groupe).toHaveTextContent('Prise de masse');
  });
});

describe('OnboardingForm : création du compte', () => {
  it('crée le profil, la pesée, l’objectif puis recharge le profil', async () => {
    render(<OnboardingForm />);
    const user = await fillStepOne({ sexe: 'Femme', naissance: '1990-03-10', taille: '165', poids: '62' });
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());

    // Profil : upsert (et non insert), pour qu'une seconde tentative aboutisse
    const [profil] = supabaseMock.callsFor('profiles', 'upsert');
    expect(getOperationArgs(profil, 'upsert')?.[0]).toMatchObject({
      id: 'user-1',
      email: 'moi@example.com',
      sexe: 'F',
      date_naissance: '1990-03-10',
      taille_cm: 165,
      poids_kg: 62,
    });

    // Première pesée du journal
    expect(supabaseMock.callsFor('weight_logs', 'upsert').length).toBeGreaterThan(0);

    // Objectif actif et cible du jour
    expect(supabaseMock.callsFor('goals', 'insert').length).toBeGreaterThan(0);
    expect(supabaseMock.callsFor('daily_targets', 'upsert').length).toBeGreaterThan(0);
  });

  it('aboutit même si la première pesée échoue (non bloquant)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    supabaseMock.setHandler((call) => {
      if (call.table === 'weight_logs') return { data: null, error: { message: 'journal indisponible' } };
      return handler(call);
    });

    render(<OnboardingForm />);
    const user = await fillStepOne();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    vi.restoreAllMocks();
  });

  it('affiche l’erreur et débloque le bouton si la création du profil échoue', async () => {
    supabaseMock.setHandler((call) => {
      if (call.table === 'profiles') return { data: null, error: { message: 'profil refusé' } };
      return handler(call);
    });

    render(<OnboardingForm />);
    const user = await fillStepOne();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    // Message générique volontaire : une erreur Supabase est un objet simple,
    // pas une Error, donc son texte Postgres brut n'est pas montré à
    // l'utilisateur (voir getErrorMessage dans le composant).
    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue');
    expect(refreshProfile).not.toHaveBeenCalled();
    // Régression : le bouton restait bloqué sur « Création... »
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeEnabled();
  });
});

describe('OnboardingForm : objectif de perte de poids', () => {
  /** Étape 1 valide, puis choix de « Perte de poids » à l'étape 2. */
  async function reachLossStep() {
    render(<OnboardingForm />);
    const user = await fillStepOne({ taille: '178', poids: '90' });
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(screen.getByRole('button', { name: 'Perte de poids' }));
    return user;
  }

  it('affiche poids cible et durée quand on choisit la perte de poids', async () => {
    await reachLossStep();
    expect(screen.getByLabelText('Poids cible (kg)')).toBeInTheDocument();
    expect(screen.getByLabelText('Durée (semaines)')).toBeInTheDocument();
  });

  it('enregistre le poids cible et la durée dans l’objectif', async () => {
    const user = await reachLossStep();

    await user.type(screen.getByLabelText('Poids cible (kg)'), '80');
    await user.type(screen.getByLabelText('Durée (semaines)'), '20');
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    const [objectif] = supabaseMock.callsFor('goals', 'insert');
    expect(getOperationArgs(objectif, 'insert')?.[0]).toMatchObject({
      type: 'loss',
      target_weight_kg: 80,
      duration_weeks: 20,
    });
  });

  it('avertit d’un rythme irréaliste (10 kg en 2 semaines) sans bloquer', async () => {
    const user = await reachLossStep();

    await user.type(screen.getByLabelText('Poids cible (kg)'), '80');
    await user.type(screen.getByLabelText('Durée (semaines)'), '2');

    // getGoalWarnings est un avertissement NON bloquant, par conception :
    // il est affiché dans l'aperçu des cibles, et l'utilisateur décide.
    const avertissements = await screen.findAllByRole('status');
    expect(avertissements.some((node) => /Rythme trop rapide/.test(node.textContent ?? ''))).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Commencer' }));
    await waitFor(() => expect(refreshProfile).toHaveBeenCalled());
    expect(supabaseMock.callsFor('goals', 'insert').length).toBeGreaterThan(0);
  });

  it('refuse un poids cible hors limites', async () => {
    const user = await reachLossStep();
    await user.type(screen.getByLabelText('Poids cible (kg)'), '10');
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(supabaseMock.callsFor('goals', 'insert')).toHaveLength(0);
  });
});
