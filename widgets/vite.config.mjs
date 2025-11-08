import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4444,
    cors: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        'account-balances': resolve(__dirname, 'src/account-balances/index.html'),
        'transactions': resolve(__dirname, 'src/transactions/index.html'),
        'spending-insights': resolve(__dirname, 'src/spending-insights/index.html'),
        'account-health': resolve(__dirname, 'src/account-health/index.html'),
      },
    },
  },
});
