import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({ plugins: [react()], test: {
  environment: 'node', include: ['tests/**/*.test.{js,jsx}'],
  testTimeout: 15000, hookTimeout: 30000, maxWorkers: 2,
} });
