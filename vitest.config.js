import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.js'],
    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'src/js/utils/**',
        'src/js/core/**',
      ],
      exclude: [
        'src/js/core/state.js',    // DOM-abhängig (Canvas-Refs, Cytoscape)
        'src/js/core/actions.js',  // Importiert Renderer/Inspector – voller DOM-Chain
        'src/js/core/theme.js',    // Direkte document.documentElement-Manipulation
        'src/js/core/constants.js',// Reine Konfigurationsdaten, keine Logik
      ],
      thresholds: {
        lines:     60,
        functions: 60,
        branches:  60,
      },
    },
  },
});
