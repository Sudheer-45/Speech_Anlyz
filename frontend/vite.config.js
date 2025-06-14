// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    base: '/',
    rollupOptions: {
      // Ensure no 'external' property exists here that would prevent bundling
    },
    // CRITICAL FIX: Ensure CommonJS modules are correctly handled and bundled
    commonjsOptions: {
      include: [/node_modules/], // Include all node_modules for CommonJS conversion
      // You might also list specific CommonJS modules if needed:
      // include: [/node_modules\/axios/],
    },
  },
  // CRITICAL FIX: Explicitly optimize axios and other problematic deps during build
  optimizeDeps: {
    include: ['axios'], // Force Vite to pre-bundle axios
  },
});
