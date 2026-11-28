import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-e2e', 'coverage', 'test-results', 'playwright-report'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Audit A-22 : les tests axe ne voient que les écrans qu'ils visitent et
      // l'état dans lequel ils les trouvent. jsx-a11y vérifie tout le code,
      // statiquement : <img> sans alt, onClick sur une <div>, champ sans label…
      ...jsxA11y.flatConfigs.recommended.rules,
      // `depth: 3` : nos <label> enveloppent l'input et leur texte est dans des
      // <span> imbriqués (association implicite, parfaitement accessible). La
      // profondeur par défaut (2) les signalerait à tort.
      'jsx-a11y/label-has-associated-control': ['error', { depth: 3 }],
      // tabIndex={0} sur une zone défilante role="region" est voulu : il la
      // rend parcourable aux flèches du clavier (historique des 30 jours).
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel', 'region'] }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // Audit A-22 : ces fichiers ne tournent pas dans un navigateur.
    // backend/netlify : Node ; backend/supabase/functions : Deno.
    files: ['backend/**/*.ts', 'scripts/**/*.ts', '*.config.ts', '*.config.js'],
    languageOptions: { globals: globals.node },
  }
);
