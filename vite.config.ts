/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

// Version affichée dans l'app (pied de page, « À propos ») : celle de package.json
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const define = { __APP_VERSION__: JSON.stringify(version) };

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define,
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  // Configuration des tests (Vitest) — https://vitest.dev/config/
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'netlify/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
    // Valeurs factices : src/lib/supabase.ts lève une erreur si elles manquent.
    // Les tests ne contactent jamais Supabase (le client est mocké).
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'netlify/functions/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts'],
    },
  },
});
