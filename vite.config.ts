import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base: '/' для локальной разработки.
// Для GitHub Pages собирать с BASE_PATH=/<имя-репозитория>/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: { port: 5173, open: true, host: true },
  build: {
    rollupOptions: {
      output: {
        // Firebase SDK тяжёлый — держим его отдельным чанком.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Тесты всегда идут против локального бэкенда: гасим ключи Firebase,
    // иначе они полезли бы в реальный Firestore.
    env: {
      VITE_FIREBASE_API_KEY: '',
      VITE_FIREBASE_PROJECT_ID: '',
      VITE_FIREBASE_MEASUREMENT_ID: '',
    },
  },
});
