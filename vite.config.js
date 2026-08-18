import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',

  /*
   * Vite 8 uses Rolldown for production bundling.
   *
   * In this application, Rolldown's default tree-shaking removed reachable
   * React Router pages from the final production bundle, including
   * Deployment Health. Disabling tree-shaking preserves the complete,
   * explicitly imported application route graph.
   *
   * Do not remove this setting unless a future Vite/Rolldown version has been
   * tested against scripts/verify_build_features.mjs.
   */
  build: {
    rolldownOptions: {
      treeshake: false,
    },
  },
});
