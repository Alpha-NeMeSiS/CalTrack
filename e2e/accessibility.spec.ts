// Contrôle d'accessibilité automatique (axe-core, règles WCAG 2.2 A et AA :
// contrastes, libellés, rôles ARIA, navigation clavier…) sur les écrans
// principaux, en thème clair et sombre. Un seul défaut fait échouer la CI.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mockSupabase, signIn } from './fixtures/supabase';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Exceptions assumées, chacune limitée à une règle et un élément précis.
const EXCEPTIONS: Array<{ rule: string; html: string; reason: string }> = [
  {
    rule: 'label-content-name-mismatch',
    html: 'aria-haspopup="menu"',
    reason:
      'Bouton du menu du compte : les initiales de l’avatar sont une image d’identité (comme la photo, ' +
      'masquée aux lecteurs d’écran) ; le nom accessible donne le nom complet.',
  },
];
const isException = (rule: string, html: string) =>
  EXCEPTIONS.some((e) => e.rule === rule && html.includes(e.html));

async function expectNoViolations(page: Page) {
  // Laisse les transitions se terminer (couleurs intermédiaires faussement en échec)
  await page.waitForTimeout(400);
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = violations.flatMap((v) =>
    v.nodes
      .filter((n) => !isException(v.id, n.html))
      .map((n) => `${v.id} : ${n.target.join(' ')}\n  ${n.failureSummary?.replace(/\n/g, '\n  ')}`)
  );
  expect(summary, `Défauts d'accessibilité :\n${summary.join('\n')}`).toEqual([]);
}

async function openAccountPage(page: Page, item: string) {
  await page.getByRole('button', { name: /Menu du compte/ }).click();
  await page.getByRole('menuitem', { name: item }).click();
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`thème ${colorScheme === 'light' ? 'clair' : 'sombre'}`, () => {
    test.use({ colorScheme });

    test.beforeEach(async ({ page }) => {
      await mockSupabase(page);
    });

    test('connexion et inscription', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
      await expectNoViolations(page);

      await page.getByRole('button', { name: 'Créer un compte' }).click();
      await expectNoViolations(page);
    });

    test.describe('connecté', () => {
      test.beforeEach(async ({ page }) => {
        await signIn(page);
        await page.goto('/');
        await expect(page.getByText('Journal du jour')).toBeVisible();
      });

      test('journal', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Eau' })).toBeVisible();
        await expectNoViolations(page);

        // Carte Eau : quantité libre
        await page.getByRole('button', { name: 'Autre…' }).click();
        await expect(page.getByLabel('Quantité (ml)')).toBeVisible();
        await expectNoViolations(page);
      });

      test('ajout d’un aliment', async ({ page }) => {
        // Mobile : bouton flottant « Ajouter un aliment » ; ordinateur : bouton « Ajouter »
        await page.getByRole('button', { name: /^Ajouter( un aliment)?$/ }).filter({ visible: true }).first().click();
        await expect(page.getByRole('heading', { name: 'Ajouter un aliment' })).toBeVisible();
        await expectNoViolations(page);

        await page.getByRole('tab', { name: 'Saisie manuelle' }).click();
        await expectNoViolations(page);
      });

      test('recettes', async ({ page }) => {
        await page.getByRole('button', { name: /^Ajouter( un aliment)?$/ }).filter({ visible: true }).first().click();
        await page.getByRole('tab', { name: 'Recettes' }).click();
        await expect(page.getByRole('button', { name: 'Modifier « Chili maison »' })).toBeVisible();
        await expectNoViolations(page);

        // Éditeur
        await page.getByRole('button', { name: 'Modifier « Chili maison »' }).click();
        await expect(page.getByRole('heading', { name: 'Modifier la recette' })).toBeVisible();
        await expectNoViolations(page);

        // Ajout au journal, en grammes
        await page.getByRole('button', { name: 'Retour aux recettes' }).click();
        await page.getByRole('button', { name: /^Chili maison/ }).click();
        await page.getByRole('button', { name: 'En grammes' }).click();
        await expect(page.getByText('Chili maison — 450 g')).toBeVisible();
        await expectNoViolations(page);
      });

      test('tendances', async ({ page }) => {
        await page.locator('button:visible', { hasText: 'Tendances' }).first().click();
        await expect(page.getByText('Historique détaillé (30 jours)')).toBeVisible();
        await expectNoViolations(page);
      });

      test('objectif', async ({ page }) => {
        await page.locator('button:visible', { hasText: 'Objectif' }).first().click();
        await expect(page.getByRole('heading', { name: 'Objectif', level: 1 })).toBeVisible();
        await expectNoViolations(page);
      });

      for (const item of ['Mon profil', 'Paramètres', 'Compte et sécurité']) {
        test(item, async ({ page }) => {
          await openAccountPage(page, item);
          await expect(page.getByRole('heading', { name: item, level: 1 })).toBeVisible();
          await expectNoViolations(page);
        });
      }
    });
  });
}
