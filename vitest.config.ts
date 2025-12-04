import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load .env.test file for test environment
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix
  const env = loadEnv('test', process.cwd(), '');

  return {
    plugins: [react()],
    test: {
      name: 'axite-mcp-template',
      environment: 'happy-dom',
      globals: true,
      globalSetup: './tests/global-setup.ts',
      setupFiles: ['./tests/setup-files.ts'],
      include: ['**/*.{test,spec}.{ts,tsx}'],
      env,
      exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/.next/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: ['lib/**', 'app/**'],
        exclude: [
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/node_modules/**',
          '**/.next/**',
          '**/dist/**',
        ],
      },
      testTimeout: 10000,
      hookTimeout: 10000,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  };
});
