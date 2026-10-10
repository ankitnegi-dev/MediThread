import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Hash-friendly static build: works on GitHub Pages / Netlify / Vercel without rewrites.
// Use relative base so dist/index.html works from any sub-path.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
