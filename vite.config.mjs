import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'REACT_APP_'],
  server: {
    port: 3000,
    strictPort: true
  },
  preview: {
    port: 4173,
    strictPort: true
  },
  test: {
    globals: true,
    pool: 'threads',
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    css: true
  }
});
