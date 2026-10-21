# ❓ SecureNotify FAQ

本页汇总 SecureNotify 的常见问题与解答，按主题分组。没有找到答案？欢迎前往 [GitHub Issues](https://github.com/your-org/subno.ts/issues) 提问。

## 📋 目录

- [通用问题](#-通用问题)
- [安装与配置](#-安装与配置)
- [使用与特性](#️-使用与特性)
- [性能](#-性能)
- [故障排查](#-故障排查)

---

## 🧭 通用问题

### ❓ 什么是 SecureNotify？

**SecureNotify** (subno.ts) 是一个专注于**公钥存储**与**消息分发**的加密推送通知服务。它提供：

| 特性               | 说明                             |
| ------------------ | -------------------------------- |
| **端到端加密**     | 消息全程加密，服务提供商无法解密 |
| **实时推送**       | 基于 SSE 的即时消息推送          |
| **灵活的频道管理** | 支持公开、加密、临时三种频道类型 |
| **完善的密钥管理** | 自动化的公钥生命周期管理         |
| **企业级安全**     | API 密钥认证、请求限流、审计日志 |

它面向需要安全、实时、可靠消息推送能力的 **应用开发者**。

**了解更多**：[用户指南](USER_GUIDE.md)

### ❓ 为什么要使用 SecureNotify？

| 特性       | SecureNotify | 自建 WebSocket | 第三方推送服务 |
| ---------- | :----------: | :------------: | :------------: |
| 端到端加密 | ✅ **内置**  | ⚠️ 需自行实现  |  ⚠️ 有限支持   |
| 实时推送   |  ✅ **SSE**  |  ✅ WebSocket  |       ✅       |
| 密钥管理   | ✅ **完整**  |     ❌ 无      |    ⚠️ 有限     |
| 自托管     | ✅ **支持**  |       ✅       |       ❌       |
| 审计日志   | ✅ **内置**  |     ❌ 无      |    ⚠️ 有限     |

**核心优势：**

- 🚀 **开箱即用**：API 化设计，无需管理 WebSocket 连接
- 🔒 **端到端加密**：混合加密架构，消息内容仅接收者可解密
- 📊 **可观测**：完整的审计日志，追踪每条消息的生命周期
- 🛡️ **安全**：多层安全防护，API 密钥认证、限流、输入验证

### ❓ SecureNotify 可以用于生产环境吗？

**当前状态**：✅ **可用于生产！**

**已就绪的特性：**

- ✅ 核心消息发布与订阅逻辑稳定
- ✅ 多种加密算法支持（RSA-2048、RSA-4096、ECC-SECP256K1）
- ✅ 两阶段密钥撤销机制
- ✅ 自动过期清理（Cron 定时任务）
- ✅ 审计日志与安全控制
- ✅ Vercel 自动部署与 Docker 容器化

**成熟度指标：**

- 📊 41 个测试文件，覆盖全部 API 端点
- 🔄 持续维护
- 🛡️ 以安全为中心的设计
- 📖 文档持续完善

> **注意**：升级版本前请务必查阅[更新日志](CHANGELOG.md)。

### ❓ 支持哪些平台？

| 平台        | 架构   |    状态     | 说明                      |
| ----------- | ------ | :---------: | ------------------------- |
| **Linux**   | x86_64 | ✅ 完整支持 | 主力平台                  |
|             | ARM64  | ✅ 完整支持 | 已在 ARM 服务器上测试     |
| **macOS**   | x86_64 | ✅ 完整支持 | Intel Mac                 |
|             | ARM64  | ✅ 完整支持 | Apple Silicon（M1/M2/M3） |
| **Windows** | x86_64 | ✅ 完整支持 | Windows 10+               |

### ❓ 如何参与贡献？

**参与方式：**

| 代码贡献    | 非代码贡献  |
| :---------- | :---------- |
| 🐛 修复缺陷 | 📖 编写教程 |
| ✨ 添加特性 | 🎨 设计素材 |
| 📝 改进文档 | 🌍 翻译文档 |
| ✅ 编写测试 | 💬 解答问题 |

**上手步骤：**

1. 🍴 Fork 仓库
2. 🌱 创建分支
3. ✏️ 修改代码
4. ✅ 补充测试
5. 📤 提交 PR

**指南**：[贡献指南](CONTRIBUTING.md)

### ❓ 在哪里可以获得帮助？

**支持渠道：**

| 渠道                                                                      | 说明               |        响应时间         |
| ------------------------------------------------------------------------- | ------------------ | :---------------------: |
| 🐛 [GitHub Issues](https://github.com/your-org/subno.ts/issues)           | 缺陷报告与特性请求 | 关键缺陷：48 小时内确认 |
| 💬 [GitHub Discussions](https://github.com/your-org/subno.ts/discussions) | 问答与想法交流     |         2-3 天          |

### ❓ 项目采用什么许可证？

本项目基于 [Apache License 2.0](../LICENSE) 发布。

**您获得的权利：**

- ✅ 使用
- ✅ 修改
- ✅ 分发
- ✅ 私有使用

---

## 📦 安装与配置

### ❓ 如何安装？

**Node.js 项目：**

```bash
# 克隆项目
git clone https://github.com/your-org/subno.ts.git
cd subno.ts

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
```

**环境变量配置：**

```env
DATABASE_URL=postgresql://user:password@localhost:5432/securenotify
REDIS_URL=redis://localhost:6379
ADMIN_MASTER_KEY=your-secure-master-key
CRON_SECRET=your-cron-secret
```

> ⚠️ **重要**：生产环境中，`ADMIN_MASTER_KEY` 和 `CRON_SECRET` 必须设置，且长度至少 32 字符。

### ❓ 系统要求是什么？

**最低要求：**

| 组件       | 要求    | 推荐配置 |
| ---------- | ------- | :------: |
| Node.js    | 22.0.0+ | 最新 LTS |
| PostgreSQL | 14+     |   16+    |
| Redis      | 7+      |    7+    |
| 内存       | 512MB   |   1GB+   |
| 磁盘空间   | 1GB     |   5GB+   |

### ❓ 如何验证安装？

```bash
# 启动开发服务器
npm run dev

# 测试健康检查
curl http://localhost:3000/api/health
# 应返回: {"status":"ok","timestamp":"...","uptime":...}

# 运行测试
npm test
```

---

## 🛠️ 使用与特性

### ❓ 如何快速上手基本用法？

**5 分钟快速开始：**

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

### ❓ 支持哪些加密算法？

**支持的算法：**

| 算法              | 密钥长度 | 说明                             |
| ----------------- | :------: | -------------------------------- |
| **RSA-2048**      | 2048 位  | 默认选项，平衡性能与安全性       |
| **RSA-4096**      | 4096 位  | 更高安全级别                     |
| **ECC-SECP256K1** |  256 位  | 椭圆曲线加密，密钥短、计算效率高 |

### ❓ 如何发送加密消息？

**完整加密消息流程：**

```javascript
// 1. 生成密钥对
const { generateKeyPairSync, publicEncrypt } = require('crypto');
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

// 2. 注册公钥（自动创建加密频道）
await fetch('http://localhost:3000/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey,
    algorithm: 'RSA-2048',
    expiresIn: 604800,
  }),
});

// 3. 发送加密消息
const encrypted = publicEncrypt(publicKey, Buffer.from('Secret message'));
await fetch('http://localhost:3000/api/publish', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel: 'enc_xxx',
    message: encrypted.toString('base64'),
    encrypted: true,
  }),
});
```

### ❓ 如何撤销密钥？

**两阶段撤销流程：**

```bash
# 1. 请求撤销（生成确认码）
curl -X POST http://localhost:3000/api/keys/enc_xxx/revoke \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Key rotation required","confirmationHours":24}'

# 2. 确认撤销（使用确认码）
curl -X DELETE "http://localhost:3000/api/keys/enc_xxx?confirmationCode=xxxxxx" \
  -H "X-API-Key: your-api-key"
```

> 💡 **提示**：两阶段撤销防止误操作，确认码在 `confirmationHours` 小时内有效。

### ❓ SecureNotify 安全吗？

**安全！** 安全是 SecureNotify 的核心关注点。

**安全特性：**

| 实现                              |    防护效果     |
| --------------------------------- | :-------------: |
| ✅ 传输加密 (TLS 1.3)             |    ✅ 防窃听    |
| ✅ 端到端加密 (RSA + AES-256-GCM) |   ✅ 防中间人   |
| ✅ 两阶段密钥撤销                 |   ✅ 防误操作   |
| ✅ API 密钥认证                   | ✅ 防未授权访问 |
| ✅ 请求限流                       |   ✅ 防 DDoS    |
| ✅ 输入验证 (Zod)                 |  ✅ 防注入攻击  |
| ✅ 审计日志                       |    ✅ 可追溯    |

### ❓ 如何报告安全漏洞？

**请负责任地报告安全问题：**

1. **不要**创建公开的 GitHub Issue
2. **使用** [GitHub Security Advisories](https://github.com/your-org/subno.ts/security/advisories/new) 私密披露通道
3. **请包含：**
   - 漏洞描述
   - 复现步骤
   - 潜在影响

**响应时间线：**

- 📧 首次响应：48 小时内确认
- 🔍 初步评估：7 天内
- 📢 公开披露：修复发布之后

完整安全策略见 [🔒 安全文档](SECURITY.md)。

---

## ⚡ 性能

### ❓ SecureNotify 有多快？

| 指标       | 目标值       |
| ---------- | ------------ |
| 消息延迟   | < 100ms      |
| 连接稳定性 | 99.9% 可用性 |
| 消息持久化 | 12 小时      |
| 并发连接数 | 10,000+      |

完整性能数据见 [📈 性能优化指南](PERFORMANCE.md)。

### ❓ 消息能发送多大？

| 类型       | 最大大小 |
| ---------- | :------: |
| 单条消息   |  4.5 MB  |
| 公钥       |   4 KB   |
| 频道元数据 |   2 KB   |

### ❓ 如何清理过期数据？

```bash
# 手动触发清理任务
curl "http://localhost:3000/api/cron/cleanup-channels?task=all" \
  -H "X-Cron-Secret: your-cron-secret"

curl "http://localhost:3000/api/cron/cleanup-keys?task=all" \
  -H "X-Cron-Secret: your-cron-secret"
```

> 💡 **提示**：生产环境中，Vercel Cron 每天自动执行清理任务。

---

## 🔧 故障排查

### ❓ 出现 "API key required" 错误

**问题：**

```json
{ "success": false, "error": { "message": "API key required", "code": "AUTH_REQUIRED" } }
```

**解决方案：**

1. 确认请求头包含 `X-API-Key`
2. 确认 API 密钥有效且未过期
3. 确认 API 密钥具有所需权限（`read`/`write`/`admin`）

### ❓ 出现 "Rate limit exceeded" 错误

**问题：**

```json
{ "success": false, "error": { "message": "Rate limit exceeded", "code": "RATE_LIMIT_EXCEEDED" } }
```

**解决方案：**

1. 降低请求频率
2. 当前限制：
   - `POST /api/publish`：10 次 / 60 秒
   - `POST /api/register`：5 次 / 60 秒
   - `GET /api/subscribe`：5 次 / 60 秒

### ❓ 出现 "Channel not found" 错误

**问题：**

```json
{ "success": false, "error": { "message": "Channel not found", "code": "NOT_FOUND" } }
```

**解决方案：**

1. 确认频道 ID 正确
2. 确认频道未过期
3. 使用 `autoCreate: true` 自动创建频道

### ❓ 出现 "Key expired" 错误

**问题：**

```json
{ "success": false, "error": { "message": "Key expired", "code": "KEY_EXPIRED" } }
```

**解决方案：**

1. 重新注册公钥
2. 设置合理的过期时间（`expiresIn`）
3. 定期轮换密钥

### ❓ SSE 连接断开

**问题：** SSE 连接频繁断开

**解决方案：**

1. 检查网络稳定性
2. 客户端实现自动重连机制
3. 服务端每 30 秒发送 keepalive 心跳

```javascript
const eventSource = new EventSource('/api/subscribe?channel=my-channel');

eventSource.onerror = error => {
  console.log('连接断开，尝试重连...');
  // 自动重连逻辑
};
```

---

## 🎯 还有其他问题？

|                         提交 Issue                         |                            发起讨论                             |
| :--------------------------------------------------------: | :-------------------------------------------------------------: |
| [🐛 报告问题](https://github.com/your-org/subno.ts/issues) | [💬 社区讨论](https://github.com/your-org/subno.ts/discussions) |

**[📖 用户指南](USER_GUIDE.md)** • **[🏠 返回首页](../README.md)**
