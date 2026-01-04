<div align="center">

# ❓ 常见问题解答 (FAQ)

### subno.ts 常见问题

[🏠 首页](../README.md) • [📖 用户指南](USER_GUIDE.md) • [🔌 API 参考](API_REFERENCE.md)

---

</div>

## 📋 目录

- [一般问题](#一般问题)
- [安装部署](#安装部署)
- [使用问题](#使用问题)
- [安全相关](#安全相关)
- [故障排除](#故障排除)

---

## 一般问题

### subno.ts 是什么？

subno.ts 是一个加密推送通知服务，主要功能：

- **公钥存储** - 注册和存储客户端的加密公钥
- **消息路由** - 发布和分发消息到频道
- **实时推送** - 通过 Server-Sent Events 实时推送消息
- **密钥管理** - 公钥的创建、查询和撤销

### 为什么不直接做端到端加密？

subno.ts **不解密**任何消息，只负责：

1. 存储公钥（让客户端获取对方的公钥）
2. 路由消息（将消息发送到订阅者）

实际的加密/解密由客户端自行完成。

### 支持哪些加密算法？

客户端可以指定任意算法标识符，服务端不限制：

- RSA-2048 / RSA-4096
- EC-SECP256R1 / EC-SECP384R1
- 任何自定义算法名称

服务端会将其转换为大写存储。

---

## 安装部署

### 环境要求是什么？

- Node.js 18+
- PostgreSQL 14+
- Redis 7+

### 如何快速启动？

```bash
# Docker Compose（推荐）
docker-compose up -d

# 手动启动
npm install
npm run db:migrate
npm run dev
```

### 数据库迁移失败？

```bash
# 检查数据库连接
psql postgresql://securenotify:securenotify@localhost:5432/securenotify

# 重新运行迁移
npm run db:migrate
```

### Redis 连接失败？

```bash
# 检查 Redis 是否运行
redis-cli ping

# 检查连接字符串
redis-cli -u redis://localhost:6379 ping
```

---

## 使用问题

### 如何注册公钥？

```bash
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
    "algorithm": "RSA-4096",
    "expiresIn": 604800
  }'
```

### 频道会自动创建吗？

是的。发布消息时如果频道不存在，会自动创建临时频道。

### 如何实现实时推送？

使用 Server-Sent Events (SSE)：

```javascript
const eventSource = new EventSource('/api/subscribe?channel=my-channel');
eventSource.onmessage = (event) => {
  console.log('收到消息:', event.data);
};
```

### 消息有大小限制吗？

最大消息大小由 `MAX_MESSAGE_SIZE` 配置，默认为 4.5MB。

### 密钥会过期吗？

是的，默认 7 天后过期。可通过 `expiresIn` 参数自定义。

---

## 安全相关

### 公钥存储安全吗？

公钥本身是公开的，不涉及安全问题。服务端只存储，不进行任何处理。

### 如何防止 API 滥用？

- 请求限流（基于 IP）
- API 密钥认证（敏感操作）
- 审计日志记录

### 如何报告安全漏洞？

请通过 GitHub Issues 报告，不要公开披露安全漏洞。

---

## 故障排除

### API 返回 429？

请求频率过高，请降低请求频率或调整限流配置。

### SSE 连接断开？

SSE 连接会每 30 秒发送 keepalive 信号。断开后客户端应重新连接。

### 消息丢失？

- 检查是否订阅了正确的频道
- 检查消息优先级设置
- 确认订阅者在线

### 无法获取公钥？

- 检查 channelId 是否正确
- 确认密钥是否过期
- 检查频道是否存在

---

<div align="center">

**[📖 用户指南](USER_GUIDE.md)** • **[🔌 API 参考](API_REFERENCE.md)** • **[🏠 首页](../README.md)**

</div>
