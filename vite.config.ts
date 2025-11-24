import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // REMOVE THIS TRASH. It exposes individual filenames to ad blockers.
  // optimizeDeps: {
  //   exclude: ['lucide-react'],
  // },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
