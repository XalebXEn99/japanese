import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 20000 },
});
