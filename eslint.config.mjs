// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import security from 'eslint-plugin-security';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'sdk/**',
      // JS 配置文件不参与 ESLint 类型检查（由 Prettier 处理格式）
      'eslint.config.js',
      '*.config.js',
      '.husky/**/*.js',
      'scripts/**/*.js',
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootKey: process.cwd(),
      },
    },
  },
  tseslint.configs.recommended,
  tseslint.configs.strict, // 严格模式
  tseslint.configs.stylistic, // 风格指南
  {
    plugins: {
      security,
      'react-hooks': reactHooks,
    },
    rules: {
      // ========== 基础规则 ==========
      '@typescript-eslint/no-explicit-any': 'warn', // 禁止 any 类型（警告级别）
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_', // 允许下划线开头的参数
          varsIgnorePattern: '^_', // 允许下划线开头的变量
        },
      ],

      // ========== 严格类型检查 ==========
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true, // 允许箭头函数省略返回类型
          allowTypedFunctionExpressions: true, // 允许有类型标注的函数表达式
        },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',

      // ========== 代码质量 ==========
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',

      // ========== React Hooks 规则 ==========
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // ========== 安全检查 ==========
      ...security.configs.recommended.rules,
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
    },
  },
  // 测试文件使用宽松规则（放在最后以覆盖前面的全局规则）
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
    },
  },
  eslintConfigPrettier,
);
