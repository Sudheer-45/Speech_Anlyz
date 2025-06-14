// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // You generally DO NOT want a `build.rollupOptions.external` property here
  // unless you have a very specific advanced use case that requires it.
  // If you find one, remove it.
  build: {
    rollupOptions: {
        external: ['something-unexpected-here'], // <-- DELETE THIS LINE AND THE COMMA BEFORE IT
    },
    base: '/',
    // Other build options can go here if needed,
    // but ensure 'rollupOptions.external' is NOT present or is empty.
    rollupOptions: {
      // If you previously added an 'external' array here, remove it.
      // external: ['some-module-name'], // <-- REMOVE THIS LINE IF IT EXISTS
    },
  },
});
