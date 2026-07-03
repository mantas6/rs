import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Relative base so the build works when served from a subpath (GitHub Pages).
  base: './',
  plugins: [react()],
})
