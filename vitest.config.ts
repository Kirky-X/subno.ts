// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// 覆盖率门禁：核心业务逻辑 95%+（用户要求），工具类 70%+。
// thresholds.lines=95 为硬门禁，CI 与本地一致，避免「本地过 CI 红」。
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(process.cwd()),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['__tests__/setup.ts'],
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'dist/**', 'sdk/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/**/*.config.*',
        'src/lib/types/**',
        'src/lib/enums/**',
        'src/db/schema.ts',
      ],
      thresholds: {
        lines: 95,
        branches: 95,
        functions: 95,
        statements: 95,
      },
    },
  },
});
