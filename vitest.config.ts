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
    // Separate test projects for better isolation
    projects: [
      {
        name: 'unit',
        testMatch: ['**/__tests__/unit/**/*.test.ts'],
        setupFiles: ['./__tests__/setup.ts'],
      },
      {
        name: 'integration',
        testMatch: ['**/__tests__/integration/**/*.test.ts'],
        setupFiles: ['./__tests__/setup.ts'],
      },
      {
        name: 'e2e',
        testMatch: ['**/__tests__/e2e/**/*.test.ts'],
        setupFiles: ['./__tests__/setup.ts'],
        // E2E tests may need longer timeout
        testTimeout: 30000,
        hookTimeout: 30000,
      },
      {
        name: 'performance',
        testMatch: ['**/__tests__/performance/**/*.test.ts'],
        setupFiles: ['./__tests__/setup.ts'],
        // Performance tests need longer timeout
        testTimeout: 60000,
        hookTimeout: 60000,
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
