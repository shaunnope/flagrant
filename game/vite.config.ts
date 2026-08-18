import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // Served from https://shaunnope.github.io/flagrant/ (project page) -
  // asset URLs need the repo name as a base path.
  base: '/flagrant/',
})
