// Initialisation commune à tous les tests (référencé dans vite.config.ts)
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Démonte les composants React rendus après chaque test
afterEach(() => {
  cleanup();
});
