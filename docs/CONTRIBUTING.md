<div align="center">

# 🤝 贡献指南

### subno.ts 项目贡献指南

[🏠 首页](../README.md) • [📖 文档](README.md) • [📝 Issues](https://github.com/Kirky-X/subno.ts/issues)

---

</div>

## 欢迎贡献者

感谢您对 subno.ts 项目的兴趣！我们欢迎各种形式的贡献：

- 🐛 修复 Bug
- ✨ 添加新功能
- 📝 改进文档
- ✅ 编写测试
- 💡 提出建议

---

## 📋 目录

- [开发环境](#开发环境)
- [项目结构](#项目结构)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [测试要求](#测试要求)
- [提交规范](#提交规范)

---

## 开发环境

### 环境要求

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose

### 安装依赖

```bash
# 安装 Node.js 依赖
npm install

# 安装 uv（Python 包管理，用于数据库迁移）
pip install uv
```

### 启动服务

```bash
# 启动数据库和 Redis
docker-compose up -d postgres redis

# 运行数据库迁移
npm run db:migrate

# 启动开发服务器
npm run dev
```

### 验证安装

```bash
# 运行测试
npm test

# 运行类型检查
npm run type-check

# 运行代码检查
npm run lint
```

---

## 项目结构

```
subno.ts/
├── app/                    # Next.js App Router 路由
│   └── api/               # API 路由
├── src/
│   ├── app/               # 源代码 API 路由
│   ├── config/            # 配置
│   ├── db/                # 数据库
│   │   ├── migrations/   # 数据库迁移
│   │   └── schema.ts     # 表结构定义
│   ├── lib/
│   │   ├── db.ts         # 数据库连接
│   │   ├── redis.ts      # Redis 连接
│   │   ├── repositories/ # 数据访问层
│   │   ├── services/     # 业务逻辑
│   │   ├── types/        # 类型定义
│   │   └── utils/        # 工具函数
│   └── middleware.ts     # 中间件
├── docs/                  # 文档
├── __tests__/             # 测试文件
├── docker-compose.yml     # Docker 配置
└── drizzle.config.ts      # Drizzle 配置
```

---

## 开发流程

### 1. Fork 项目

点击 GitHub 页面右上角的 Fork 按钮。

### 2. 克隆仓库

```bash
git clone https://github.com/YOUR_USERNAME/subno.ts.git
cd subno.ts
```

### 3. 创建分支

```bash
# 创建功能分支
git checkout -b feature/new-feature

# 或创建修复分支
git checkout -b fix/issue-description
```

### 4. 开发与测试

```bash
# 启动开发服务器
npm run dev

# 运行测试
npm test

# 运行特定测试
npm test -- --testNamePattern="register"

# 运行 lint
npm run lint

# 自动修复 lint 问题
npm run lint -- --fix
```

### 5. 提交代码

```bash
# 查看更改
git status

# 添加更改
git add .

# 提交
git commit -m "feat(api): add new feature"
```

### 6. 提交 PR

1. 推送分支到你的 fork
2. 在 GitHub 上创建 Pull Request
3. 填写 PR 模板
4. 等待代码审查

---

## 代码规范

### TypeScript

- 使用 TypeScript 严格模式
- 避免使用 `any`
- 使用接口定义类型

**推荐：**

```typescript
interface RegisterKeyInput {
  publicKey: string;
  algorithm: string;
  expiresIn?: number;
}
```

**不推荐：**

```typescript
const func = (data: any) => {
  // ...
};
```

### 命名规范

- 变量/函数：camelCase
- 类/接口：PascalCase
- 常量：UPPER_SNAKE_CASE
- 文件：kebab-case

### 错误处理

- 使用 try-catch 处理异步操作
- 返回结构化的错误响应
- 记录错误日志

### 代码格式

项目使用 Prettier 和 ESLint：

```bash
# 格式化代码
npm run format

# 检查格式
npm run format:check
```

---

## 测试要求

### 测试类型

| 类型 | 位置 | 说明 |
|------|------|------|
| 单元测试 | `__tests__/unit/` | 测试单个函数/类 |
| 集成测试 | `__tests__/integration/` | 测试 API 端点 |
| E2E 测试 | `__tests__/e2e/` | 端到端测试 |

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 生成覆盖率报告
npm run test:coverage
```

### 编写测试

```typescript
import { describe, it, expect } from 'vitest';

describe('Register API', () => {
  it('should register a public key', async () => {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: '-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----',
        algorithm: 'RSA-2048'
      })
    });
    
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.channelId).toBeDefined();
  });
});
```

---

## 提交规范

### 提交类型

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构代码 |
| `test` | 测试相关 |
| `chore` | 构建/工具/依赖更新 |

### 提交格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

**示例：**

```
feat(api): add algorithm field to key registration

- Allow clients to specify encryption algorithm
- Store algorithm in database
- Return algorithm in response

Closes #123
```

---

## 常见问题

### 如何添加新的 API 路由？

1. 在 `app/api/` 目录下创建新文件夹
2. 添加 `route.ts` 文件
3. 实现 GET/POST/PUT/DELETE 处理器
4. 添加类型定义
5. 编写测试

### 如何修改数据库 schema？

1. 修改 `src/db/schema.ts`
2. 创建新迁移：`npm run db:generate migration_name`
3. 运行迁移：`npm run db:migrate`
4. 更新类型定义

### 如何配置环境变量？

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置
vim .env
```

---

<div align="center">

### 💝 感谢您的贡献！

**[📝 创建 Issue](https://github.com/Kirky-X/subno.ts/issues/new)** • **[📖 文档](README.md)** • **[🏠 首页](../README.md)**

</div>
