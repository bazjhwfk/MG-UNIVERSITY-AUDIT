import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works at any GitHub Pages URL
  // (https://<user>.github.io/<repo>/) without knowing the repo name.
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    // Needed so the print template stylesheet imported with ?raw isn't stubbed out.
    css: true,
  },
});
