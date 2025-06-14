// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // This 'base' property is generally good to have for Vercel,
    // ensuring correct path resolution for assets.
    base: '/', 
    
    rollupOptions: {
      // The problematic `external` array has been removed from here.
      // Make sure NO 'external' property exists inside rollupOptions.
    },
  },
});
