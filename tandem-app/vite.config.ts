import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Note: API routes (/api/*) need to be served separately
  // They use @google-cloud/cloudbuild which is server-side only
  // Deploy API routes as serverless functions (Next.js, Netlify, etc.)
})
