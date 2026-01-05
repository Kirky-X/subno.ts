// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
    setupFiles: ['./__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        '__tests__/',
        '**/*.config.ts',
        '**/index.ts',
      ],
    },
    // E2E tests may need longer timeout
    testTimeout: 30000,
    hookTimeout: 30000,
    // Disable parallel execution to avoid shared state issues (Redis/DB)
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
