import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Separate from vite.config.ts (which sets a GitHub Pages `base`, irrelevant
// to tests) but shares the same svelte() plugin so `.svelte.ts` files (rune
// syntax) compile correctly under vitest.
export default defineConfig({
  plugins: [svelte()],
  test: {
    environment: 'node',
  },
})
