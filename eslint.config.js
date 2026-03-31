import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import security from 'eslint-plugin-security';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '.next/**', 'dist/**', 'build/**', 'sdk/**'],
  },
  tseslint.configs.recommended,
  tseslint.configs.strict,  // 严格模式
  tseslint.configs.stylistic,  // 风格指南
  // .husky 和根目录的 JS 配置文件使用简化规则
  {
    files: ['.husky/**/*.js', '.prettierrc.js', '*.config.js'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  // 测试文件使用宽松规则
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/__tests__/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  {
    plugins: {
      security,
      'react-hooks': reactHooks,
    },
    rules: {
      // ========== 基础规则 ==========
      '@typescript-eslint/no-explicit-any': 'warn',  // 禁止 any 类型（警告级别）
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',  // 允许下划线开头的参数
        varsIgnorePattern: '^_',  // 允许下划线开头的变量
      }],
      
      // ========== 严格类型检查 ==========
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,  // 允许箭头函数省略返回类型
        allowTypedFunctionExpressions: true,  // 允许有类型标注的函数表达式
      }],  // 强制函数返回类型
      '@typescript-eslint/no-non-null-assertion': 'error',  // 禁止非空断言 (!)
      '@typescript-eslint/no-floating-promises': 'error',  // 必须处理 Promise
      '@typescript-eslint/await-thenable': 'error',  // await 必须是 Promise
      '@typescript-eslint/prefer-optional-chain': 'error',  // 使用可选链
      
      // ========== 代码质量 ==========
      '@typescript-eslint/no-unused-expressions': 'error',  // 禁止未使用的表达式
      '@typescript-eslint/prefer-nullish-coalescing': 'error',  // 优先使用空值合并运算符
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',  // 优先使用 startsWith/endsWith
      
      // ========== React Hooks 规则 ==========
      'react-hooks/rules-of-hooks': 'error',  // React Hooks 规则
      'react-hooks/exhaustive-deps': 'warn',  // useEffect 依赖检查
      
      // ========== 安全检查 ==========
      ...security.configs.recommended.rules,
      'security/detect-object-injection': 'warn',  // 检测对象注入
      'security/detect-non-literal-fs-filename': 'warn',  // 检测动态文件路径
      'security/detect-eval-with-expression': 'error',  // 禁止动态 eval
      'security/detect-no-csrf-before-method-override': 'error',  // CSRF 检查
      'security/detect-possible-timing-attacks': 'warn',  // 时序攻击检测
      'security/detect-child-process': 'warn',  // 子进程使用警告
      'security/detect-disable-mustache-escape': 'error',  // 禁止禁用转义
    },
  },
  eslintConfigPrettier  // 禁用与 Prettier 冲突的规则
);
