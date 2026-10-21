<div align="center">

<img src="public/assets/logo.png" alt="SecureNotify Logo" width="180">

[![CI Status](https://github.com/your-org/subno.ts/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/subno.ts/actions/workflows/ci.yml) [![Version](https://img.shields.io/npm/v/subno.ts.svg)](https://www.npmjs.com/package/subno.ts) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE) [![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-339933?logo=node.js)](https://nodejs.org) [![Coverage](https://img.shields.io/badge/coverage-99.31%25-brightgreen.svg)](coverage/)

**中文** | [English](README_EN.md)

**生产级加密推送通知服务，端到端加密**

[✨ 功能特性](#-功能特性) • [🚀 快速开始](#-快速开始) • [📚 文档](#-文档) • [💻 示例](#-示例) • [🤝 参与贡献](#-参与贡献)

</div>

---

<div align="center">

### 🎯 公钥存储，实时分发

注册公钥即可建立加密频道，通过 SSE 实时推送消息：

<table style="width:100%; border-collapse: collapse">
<tr>
<td align="center" width="25%">🔐<br><b>端到端加密</b><br><span style="color:#64748B">RSA + AES-256-GCM</span></td>
<td align="center" width="25%">⚡<br><b>实时推送</b><br><span style="color:#64748B">SSE 即时送达</span></td>
<td align="center" width="25%">🛡️<b>安全控制</b><br><span style="color:#64748B">API 密钥 · 限流 · 审计</span></td>
<td align="center" width="25%">🔑<br><b>密钥管理</b><br><span style="color:#64748B">两阶段撤销 · 自动过期</span></td>
</tr>
</table>

</div>

---

## 📋 目录

- [✨ 功能特性](#-功能特性)
- [🚀 快速开始](#-快速开始)
- [📚 文档](#-文档)
- [💻 示例](#-示例)
- [🏗️ 架构](#️-架构)
- [🧪 测试](#-测试)
- [📊 性能](#-性能)
- [🔒 安全](#-安全)
- [🗺️ 开发路线图](#️-开发路线图)
- [🤝 参与贡献](#-参与贡献)
- [📋 更新日志](#-更新日志)
- [📄 许可证](#-许可证)
- [🙏 致谢](#-致谢)
- [📞 联系与支持](#-联系与支持)
- [⭐ Star 历史](#-star-历史)

---

## ✨ 功能特性

<table style="width:100%; border-collapse: collapse">
<tr>
<td width="50%" style="vertical-align:top; padding: 12px">🔐 <b>公钥注册与管理</b><br><span style="color:#64748B">支持 RSA-2048、RSA-4096、ECC-SECP256K1 多种算法的公钥注册、存储和查询</span></td>
<td width="50%" style="vertical-align:top; padding: 12px">📢 <b>频道管理</b><br><span style="color:#64748B">支持公开频道、加密频道和临时频道三种类型，满足不同场景需求</span></td>
</tr>
<tr>
<td width="50%" style="vertical-align:top; padding: 12px">⚡ <b>实时消息推送</b><br><span style="color:#64748B">基于 Server-Sent Events (SSE) 的实时消息分发，即时送达订阅者</span></td>
<td width="50%" style="vertical-align:top; padding: 12px">🔒 <b>消息加密</b><br><span style="color:#64748B">采用混合加密架构（RSA + AES-256-GCM），支持端到端加密</span></td>
</tr>
<tr>
<td width="50%" style="vertical-align:top; padding: 12px">🛡️ <b>安全控制</b><br><span style="color:#64748B">API 密钥认证、请求限流、审计日志、输入验证等多重安全机制</span></td>
<td width="50%" style="vertical-align:top; padding: 12px">🎯 <b>消息优先级</b><br><span style="color:#64748B">支持优先级队列（CRITICAL/HIGH/NORMAL/LOW/BULK），确保重要消息优先处理</span></td>
</tr>
<tr>
<td width="50%" style="vertical-align:top; padding: 12px">🔑 <b>两阶段撤销</b><br><span style="color:#64748B">密钥撤销采用两阶段确认机制，防止误操作</span></td>
<td width="50%" style="vertical-align:top; padding: 12px">🧹 <b>自动清理</b><br><span style="color:#64748B">Cron 定时任务自动清理过期频道和密钥</span></td>
</tr>
</table>

---

## 🚀 快速开始

### 📦 安装

```bash
git clone https://github.com/your-org/subno.ts.git
cd subno.ts
npm install
```

要求 Node.js 22.0.0 及以上（与 `package.json` engines 一致）。

### 💡 最小示例

```bash
# 1. 创建公开频道
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{"name":"my-channel","type":"public"}'

# 2. 发布消息
curl -X POST http://localhost:3000/api/publish \
  -H "Content-Type: application/json" \
  -d '{"channel":"my-channel","message":"Hello, World!","priority":"normal"}'

# 3. 订阅实时消息
curl -N http://localhost:3000/api/subscribe?channel=my-channel
```

### 🧭 核心概念

- **频道**：消息分发的逻辑容器，分为公开频道（`pub_`）、加密频道（`enc_`）、临时频道（`tmp_`）。
- **公钥**：加密通信的基础，用于加密发送给特定接收者的消息。
- **消息优先级**：五级优先级（CRITICAL/HIGH/NORMAL/LOW/BULK），高优先级消息优先处理。
- **两阶段撤销**：密钥撤销需要确认码确认，防止误操作。

---

## 📚 文档

| 文档                                   | 说明                             |
| -------------------------------------- | -------------------------------- |
| [📖 用户指南](docs/USER_GUIDE.md)      | 从安装到进阶的完整使用教程       |
| [📘 API 参考](docs/API_REFERENCE.md)   | 全部公开 API 的详细说明          |
| [🏗️ 架构文档](docs/ARCHITECTURE.md)    | 设计原则、模块划分与数据流       |
| [📈 性能优化指南](docs/PERFORMANCE.md) | 基准数据、性能口径与优化建议     |
| [🔒 安全文档](docs/SECURITY.md)        | 安全设计、最佳实践与漏洞处理记录 |
| [❓ FAQ](docs/FAQ.md)                  | 常见问题解答                     |
| [📋 更新日志](docs/CHANGELOG.md)       | 每个版本的变更记录               |
| [🤝 贡献指南](docs/CONTRIBUTING.md)    | 如何参与项目开发                 |

---

## 💻 示例

```bash
# 注册公钥（自动创建加密频道）
curl -X POST http://localhost:3000/api/register \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
    "algorithm": "RSA-4096",
    "expiresIn": 604800
  }'

# 发布加密消息
curl -X POST http://localhost:3000/api/publish \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "enc_xxx",
    "message": "<加密后的消息>",
    "encrypted": true
  }'

# 请求撤销密钥
curl -X POST http://localhost:3000/api/keys/enc_xxx/revoke \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Key rotation required","confirmationHours":24}'

# 确认撤销密钥
curl -X DELETE "http://localhost:3000/api/keys/enc_xxx?confirmationCode=xxxxxx" \
  -H "X-API-Key: your-api-key"
```

---

## 🏗️ 架构

SecureNotify 采用分层设计：API 路由层 → 业务逻辑层 → 数据访问层，中间件统一处理认证、限流、日志等横切关注点。核心数据通路为：请求验证 → 认证/限流 → 业务逻辑 → 数据持久化 → 响应。

架构图、模块划分、数据流详情见 [🏗️ 架构文档](docs/ARCHITECTURE.md)。

---

## 🧪 测试

### 🎯 测试策略

测试覆盖四层：单元测试（`src/lib/` 各模块）、服务层测试（`__tests__/*.service.test.ts`）、API 路由测试（`__tests__/*-route.test.ts`）、功能测试（`api-functional.test.ts`）。

### ▶️ 运行命令（与 CI 一致）

```bash
# 运行全部测试
npm test

# 生成覆盖率报告
npm run test:coverage

# 代码检查
npm run lint

# 类型检查
npx tsc --noEmit
```

### 📊 测试规模

截至 v0.2.2：41 个测试文件，覆盖全部 API 端点、服务层、工具函数。

---

## 📊 性能

| 指标       | 目标值       |
| ---------- | ------------ |
| 消息延迟   | < 100ms      |
| 连接稳定性 | 99.9% 可用性 |
| 消息持久化 | 12 小时      |
| 并发连接数 | 10,000+      |

完整基准数据表与测量口径见 [📈 性能优化指南](docs/PERFORMANCE.md)。

---

## 🔒 安全

### 🛡️ 安全设计

安全设计围绕消息全生命周期防护展开：传输加密（TLS 1.3）、应用层加密（RSA + AES-256-GCM）、密钥管理（两阶段撤销、自动过期）、访问控制（API 密钥认证、权限分级）、请求限流（IP + User-Agent 双重限流）、输入验证（Zod Schema）、审计日志（全操作记录）。

### 🚨 报告安全漏洞

请勿通过公开 issue 报告安全漏洞。请使用 GitHub [Security Advisories](https://github.com/your-org/subno.ts/security/advisories/new) 私密披露通道提交报告。项目承诺 48 小时内确认、7 天内给出初步评估。完整政策见 [SECURITY.md](docs/SECURITY.md)。

---

## 🗺️ 开发路线图

<table style="width:100%; border-collapse: collapse">
<tr><th style="text-align:center">状态</th><th style="text-align:left">方向</th><th style="text-align:left">条目</th></tr>
<tr><td align="center">✅</td><td>核心功能</td><td>公钥注册、频道管理、消息发布、实时订阅</td></tr>
<tr><td align="center">✅</td><td>安全</td><td>API 密钥认证、两阶段撤销、审计日志、速率限制</td></tr>
<tr><td align="center">✅</td><td>部署</td><td>Vercel 自动部署、Docker 容器化、Cron 定时任务</td></tr>
<tr><td align="center">🚧</td><td>SDK 完善</td><td>TypeScript SDK 已就绪，Python/Rust/Java/C SDK 进行中</td></tr>
<tr><td align="center">📋</td><td>监控</td><td>Prometheus 指标、分布式追踪</td></tr>
<tr><td align="center">📋</td><td>多租户</td><td>租户隔离、配额管理</td></tr>
</table>

---

## 🤝 参与贡献

详细的贡献流程与代码规范请参阅 [🤝 贡献指南](docs/CONTRIBUTING.md)。

### 🛠️ 开发环境

工具链为 Node.js 22.0.0+（`package.json` engines 锁定）；提交前运行 `npm run lint` 与 `npx tsc --noEmit`；Husky Git 钩子在 pre-commit 执行 lint-staged（ESLint + Prettier）。

### 💖 贡献方式

<table style="width:100%; border-collapse: collapse">
<tr>
<td width="33%" align="center" style="padding: 16px">

### 🐛 报告 Bug

发现问题？<br>
<a href="https://github.com/your-org/subno.ts/issues/new">创建 Issue</a>

</td>
<td width="33%" align="center" style="padding: 16px">

### 💡 功能建议

有好想法？<br>
<a href="https://github.com/your-org/subno.ts/discussions">开始讨论</a>

</td>
<td width="33%" align="center" style="padding: 16px">

### 🔧 提交 PR

想贡献代码？<br>
<a href="https://github.com/your-org/subno.ts/pulls">Fork 并提交 PR</a>

</td>
</tr>
</table>

---

## 📋 更新日志

完整版本历史见 [📋 更新日志](docs/CHANGELOG.md)（遵循 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 格式，语义化版本）。

| 版本  | 日期    | 要点                                    |
| ----- | ------- | --------------------------------------- |
| 0.2.2 | 2026-01 | 两阶段密钥撤销、Cron 清理任务、审计日志 |
| 0.2.0 | 2025-12 | SSE 实时订阅、优先级队列、速率限制      |
| 0.1.0 | 2025-11 | 初始版本：公钥注册、频道管理、消息发布  |

---

## 📄 许可证

本项目采用 Apache License 2.0。详见 [LICENSE](LICENSE)。

---

## 🙏 致谢

### 🌟 核心依赖

SecureNotify 站在以下优秀开源项目的肩膀上：

| 依赖                                     | 用途            |
| ---------------------------------------- | --------------- |
| [Next.js](https://nextjs.org)            | 全栈 React 框架 |
| [PostgreSQL](https://www.postgresql.org) | 关系型数据库    |
| [Redis](https://redis.io)                | 缓存与消息总线  |
| [Drizzle ORM](https://orm.drizzle.team)  | 类型安全 ORM    |
| [Zod](https://zod.dev)                   | 运行时类型校验  |

### 💝 特别感谢

感谢 Node.js 社区与所有 [贡献者](https://github.com/your-org/subno.ts/graphs/contributors)。

---

## 📞 联系与支持

<table style="width:100%; max-width: 600px">
<tr>
<td align="center" width="33%">
<a href="https://github.com/your-org/subno.ts/issues"><b style="color:#991B1B">Issues</b></a><br>
<span style="color:#64748B">报告问题和 Bug</span>
</td>
<td align="center" width="33%">
<a href="https://github.com/your-org/subno.ts/discussions"><b style="color:#1E40AF">讨论区</b></a><br>
<span style="color:#64748B">提问和分享想法</span>
</td>
<td align="center" width="33%">
<a href="https://github.com/your-org/subno.ts"><b style="color:#1E293B">GitHub</b></a><br>
<span style="color:#64748B">查看源代码</span>
</td>
</tr>
</table>

---

## ⭐ Star 历史

[![Star History Chart](https://api.star-history.com/svg?repos=your-org/subno.ts&type=Date)](https://star-history.com/#your-org/subno.ts&Date)

如果这个项目对您有帮助，请考虑给它一个 ⭐️！

**由 Kirky.X 构建**

---

<sub>© 2026 SecureNotify. 保留所有权利。</sub>
