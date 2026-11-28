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

    test('à propos, depuis la connexion', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation', { name: 'Informations sur l’application' }).getByRole('button', { name: 'À propos' }).click();
      await expect(page.getByRole('heading', { name: 'À propos', level: 1 })).toBeVisible();
      await expectNoViolations(page);
    });

    test('Guide, depuis la connexion', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('navigation', { name: 'Informations sur l’application' }).getByRole('button', { name: 'Guide' }).click();
      await expect(page.getByRole('heading', { name: 'Guide', level: 1 })).toBeVisible();
      await expectNoViolations(page);
    });

    test.describe('premier lancement et mises à jour', () => {
      test('visite guidée : étapes 1 à 5, puis enregistrée', async ({ page }) => {
        const { writes } = await mockSupabase(page, { tourSeen: false });
        await signIn(page);
        await page.goto('/');

        await expect(page.getByRole('dialog', { name: 'Votre journée en un coup d’œil' })).toBeVisible();
        await expectNoViolations(page);
        for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Suivant' }).click();
        await expect(page.getByRole('dialog', { name: 'Aller plus loin' })).toBeVisible();
        await expectNoViolations(page);

        await page.getByRole('button', { name: 'Terminer' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect.poll(() => writes.some((w) => w.table === 'user_preferences' && 'tour_completed_at' in w.body)).toBe(true);
        // Visite terminée : pas de « Quoi de neuf ? » dans la même session
        await expect(page.getByRole('dialog', { name: 'Quoi de neuf ?' })).toHaveCount(0);
      });

      test('« Quoi de neuf ? » après une mise à jour, puis enregistrée', async ({ page }) => {
        const { writes } = await mockSupabase(page, { lastSeenVersion: '2.0.0' });
        await signIn(page);
        await page.goto('/');

        const dialog = page.getByRole('dialog', { name: 'Quoi de neuf ?' });
        await expect(dialog).toBeVisible();
        await expectNoViolations(page);
        await dialog.getByRole('button', { name: 'C’est noté' }).click();
        await expect(dialog).toHaveCount(0);
        await expect.poll(() => writes.some((w) => w.table === 'user_preferences' && 'last_seen_version' in w.body)).toBe(true);
      });
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

        // Suppression : confirmation dans la ligne, au style de l'app (pas de fenêtre du navigateur)
        let nativeDialog = false;
        page.on('dialog', (dialog) => {
          nativeDialog = true;
          void dialog.dismiss();
        });
        const firstDelete = page.getByRole('button', { name: /^Supprimer / }).first();
        await firstDelete.click();
        await expect(page.getByRole('button', { name: /^Confirmer la suppression de/ })).toBeVisible();
        await expectNoViolations(page);
        await page.getByRole('button', { name: /^Annuler la suppression de/ }).click();
        expect(nativeDialog).toBe(false);

        // Carte Eau : quantité libre
        await page.getByRole('button', { name: 'Autre…' }).click();
        await expect(page.getByLabel('Quantité (ml)')).toBeVisible();
        await expectNoViolations(page);

        // Journal défilant : la zone est nommée et atteignable au clavier
        await expect(page.getByRole('region', { name: 'Journal du jour' })).toBeVisible();

        // Carte « Ma pesée » : moment de la pesée (le matin, à jeun ou plus tard)
        const weighIn = page.getByRole('group', { name: 'Moment de la pesée' });
        await expect(weighIn.getByRole('radio', { name: 'Le matin, à jeun' })).toBeVisible();
        await weighIn.getByRole('radio', { name: 'Plus tard dans la journée' }).check();
        await expect(weighIn.getByRole('radio', { name: 'Plus tard dans la journée' })).toBeChecked();
        await expectNoViolations(page);

        // Fenêtre « Détail par repas » (bouton du bloc calories + macros)
        await page.getByRole('button', { name: 'Détail', exact: true }).click();
        const breakdown = page.getByRole('dialog', { name: 'Détail par repas' });
        await expect(breakdown.getByRole('row', { name: /Total/ })).toBeVisible();
        // Toutes les colonnes tiennent sans défilement horizontal, même sur
        // téléphone : sinon la colonne « Fibres » est coupée sans que rien ne
        // l'indique (vu sur une capture Pixel 7).
        const fitsWithoutScroll = await breakdown
          .getByRole('table')
          .evaluate((table) => table.parentElement!.scrollWidth <= table.parentElement!.clientWidth);
        expect(fitsWithoutScroll).toBe(true);
        await expectNoViolations(page);
        await page.keyboard.press('Escape');
        await expect(breakdown).toBeHidden();
      });

      test('ajout d’un aliment', async ({ page }) => {
        // Mobile : bouton flottant « Ajouter un aliment » ; ordinateur : bouton « Ajouter »
        await page.getByRole('button', { name: /^Ajouter( un aliment)?$/ }).filter({ visible: true }).first().click();
        await expect(page.getByRole('heading', { name: 'Ajouter un aliment' })).toBeVisible();
        await expectNoViolations(page);

        await page.getByRole('tab', { name: 'Saisie manuelle' }).click();
        await expectNoViolations(page);

        // Ajouts à la suite : la fenêtre reste ouverte avec une confirmation
        await page.getByLabel("Nom de l'aliment").fill('Salade maison');
        await page.getByLabel('Quantité (g)').fill('250');
        await page.getByLabel('Calories (kcal)').fill('320');
        const dialog = page.getByRole('dialog', { name: 'Ajouter un aliment' });
        await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click();
        await expect(dialog.getByRole('status')).toContainText('✓ Salade maison ajouté');
        // Visible sans défiler, même après un long formulaire (mobile)
        await expect(dialog.getByRole('status')).toBeInViewport();
        await expect(dialog).toBeVisible();
        await expect(page.getByLabel("Nom de l'aliment")).toHaveValue('');
        await expectNoViolations(page);

        await page.getByRole('button', { name: 'Fermer la fenêtre' }).click();
        await expect(dialog).toBeHidden();
      });

      test('produit scanné sans valeurs : estimation', async ({ page }) => {
        // Produit Open Food Facts sans valeurs, puis produits proches de la même marque
        await page.route('**/api/off/product**', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              product: {
                code: '3242272270157',
                product_name: 'Sodebo pastabox 330g fusilli a la bolognaise',
                brands: 'Sodebo',
                serving_size: '330 g',
                nutriments: {},
              },
            }),
          })
        );
        const hit = (code: string, name: string, kcal: number, proteins: number, fat: number, carbs: number) => ({
          code,
          product_name: name,
          brands: 'Sodebo',
          nutriments: { 'energy-kcal_100g': kcal, proteins_100g: proteins, fat_100g: fat, carbohydrates_100g: carbs },
        });
        await page.route('**/api/off/search**', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              products: [
                hit('3242272252054', 'Pasta Box fusilli à la bolognaise', 123, 6.7, 3, 16),
                hit('3242272252528', 'Pastabox fusilli carbonara', 160, 5.8, 7.6, 17),
                hit('3242272251750', 'Pastabox fusilli napolitaine au poulet', 123, 6.6, 2.8, 17),
              ],
            }),
          })
        );

        await page.getByRole('button', { name: /^Ajouter( un aliment)?$/ }).filter({ visible: true }).first().click();
        const dialog = page.getByRole('dialog', { name: 'Ajouter un aliment' });
        await dialog.getByRole('button', { name: 'Scanner un code-barres' }).click();
        await dialog.getByLabel('Ou saisissez le code-barres').fill('3242272270157');
        await dialog.getByLabel('Ou saisissez le code-barres').press('Enter');

        const card = dialog.getByRole('region', { name: 'Estimation pour 100 g' });
        await expect(card).toBeVisible();
        await expect(card).toContainText('≈ 123 kcal');
        await card.getByRole('button', { name: 'Ou choisir un produit proche (3)' }).click();
        await expect(card.getByRole('listitem')).toHaveCount(3);
        await expectNoViolations(page);

        await card.getByRole('button', { name: 'Utiliser l’estimation' }).click();
        await expect(dialog.getByText(/d’après 1 produit proche/)).toBeVisible();
        await expect(dialog.getByLabel('Calories (kcal)')).toHaveValue('123');
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

      test('à propos', async ({ page }) => {
        // Pied de page sous le journal, lisible en entier : le bouton flottant
        // « Ajouter un aliment » (mobile) ne le recouvre pas en bas de page
        const footer = page.locator('footer');
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        const fab = page.getByRole('button', { name: 'Ajouter un aliment' }).filter({ visible: true });
        if (await fab.count()) {
          // Dernière ligne de texte du pied de page (sans la marge du bas)
          const [f, b] = [await footer.getByText(/^Données nutritionnelles/).boundingBox(), await fab.boundingBox()];
          expect(f && b && f.y + f.height <= b.y, 'le bouton flottant recouvre le pied de page').toBe(true);
        }
        await footer.getByRole('button', { name: 'Sources' }).click();
        await expect(page.getByRole('heading', { name: 'À propos', level: 1 })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Télécharger mes données' })).toBeVisible();
        await expectNoViolations(page);
      });

      test('Guide et nouveautés', async ({ page }) => {
        await page.getByRole('button', { name: /Menu du compte/ }).click();
        await page.getByRole('menuitem', { name: 'Guide' }).click();
        await expect(page.getByRole('heading', { name: 'Guide', level: 1 })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Revoir la visite' })).toBeVisible();
        await expectNoViolations(page);

        await page.getByRole('navigation', { name: 'Informations sur l’application' }).getByRole('button', { name: 'À propos' }).click();
        await page.getByRole('button', { name: 'Voir les nouveautés' }).click();
        await expect(page.getByRole('dialog', { name: 'Quoi de neuf ?' })).toContainText('Historique des mises à jour');
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
