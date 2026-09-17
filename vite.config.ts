// `defineConfig` comes from vitest/config rather than vite so the `test` key is typed.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // scripts/ holds the triage rules the scoring run applies. They are plain
    // ESM so node can run them without a build step, and they are tested here
    // rather than left to a model's reading of a prompt.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
