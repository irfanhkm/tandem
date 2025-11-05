import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    commonjsOptions: {
      ignore: ['@google-cloud/cloudbuild']
    },
    rollupOptions: {
      external: (id) => {
        // Mark Google Cloud packages as external
        return id.includes('@google-cloud/')
      }
    }
  },
  optimizeDeps: {
    exclude: ['@google-cloud/cloudbuild']
  },
  resolve: {
    alias: {
      '@google-cloud/cloudbuild': '@google-cloud/cloudbuild'
    }
  }
})
