# 📈 SecureNotify 性能优化指南

本文档描述 SecureNotify 的性能设计、基准数据与优化建议。

## 📋 目录

- [性能目标](#-性能目标)
- [基准数据](#-基准数据)
- [性能设计](#-性能设计)
- [优化建议](#-优化建议)
- [监控与观测](#-监控与观测)

---

## 🎯 性能目标

| 指标               | 目标值  | 测量条件           |
| ------------------ | ------- | ------------------ |
| 消息发布延迟 (P99) | < 100ms | 单实例，本地 Redis |
| 消息订阅延迟 (P99) | < 200ms | SSE 连接已建立     |
| 公钥查询延迟 (P99) | < 50ms  | 缓存命中           |
| 并发连接数         | 10,000+ | 单实例             |
| 消息持久化时间     | 12 小时 | Redis TTL          |
| 系统可用性         | 99.9%   | 月度统计           |

---

## 📊 基准数据

### 测试环境

| 组件       | 配置   |
| ---------- | ------ |
| CPU        | 4 vCPU |
| 内存       | 8 GB   |
| Node.js    | 22.x   |
| PostgreSQL | 16.x   |
| Redis      | 7.x    |

### 基准结果

| 操作     | P50  | P95  | P99   | 吞吐量      |
| -------- | ---- | ---- | ----- | ----------- |
| 公钥注册 | 15ms | 35ms | 60ms  | 500 req/s   |
| 频道查询 | 5ms  | 15ms | 30ms  | 2000 req/s  |
| 消息发布 | 20ms | 50ms | 100ms | 800 req/s   |
| 消息订阅 | 10ms | 30ms | 60ms  | 1000 conn/s |
| 密钥撤销 | 25ms | 60ms | 120ms | 300 req/s   |

> ⚠️ **注意**：以上数据为开发环境基准，实际性能取决于配置与负载。

---

## ⚡ 性能设计

### 架构层面

| 设计           | 说明                 | 收益             |
| -------------- | -------------------- | ---------------- |
| **无状态 API** | 会话数据存储在 Redis | 水平扩展         |
| **Redis 缓存** | 公钥查询 Cache-Aside | 减少 DB 查询     |
| **连接池**     | PostgreSQL 连接池    | 避免连接耗尽     |
| **SSE 长连接** | 单向推送，自动重连   | 减少轮询开销     |
| **优先级队列** | 高优先级消息优先处理 | 关键消息及时送达 |

### 缓存策略

```typescript
// Cache-Aside 模式
class KeyCacheService {
  async get(publicKeyId: string): Promise<PublicKey | null> {
    // 1. 先查 Redis 缓存
    const cached = await redis.get(`key:${publicKeyId}`);
    if (cached) return cached;

    // 2. 缓存未命中，查数据库
    const key = await db.publicKeys.findById(publicKeyId);
    if (key) {
      // 3. 写入缓存 (TTL: 7 天)
      await redis.setex(`key:${publicKeyId}`, 604800, key);
    }
    return key;
  }
}
```

**缓存配置：**

| 数据类型 | TTL    | 说明             |
| -------- | ------ | ---------------- |
| 公钥信息 | 7 天   | 减少数据库查询   |
| 频道信息 | 1 小时 | 平衡新鲜度与性能 |
| API 密钥 | 5 分钟 | 快速验证         |

### 数据库优化

| 优化项       | 实现                                    | 收益         |
| ------------ | --------------------------------------- | ------------ |
| **索引**     | `public_keys.channel_id`、`channels.id` | 查询提速 10x |
| **连接池**   | 最大 20 连接                            | 避免连接耗尽 |
| **批量操作** | 批量插入消息                            | 减少往返次数 |
| **查询优化** | 选择性字段查询                          | 减少数据传输 |

### Redis 优化

| 优化项       | 实现          | 收益         |
| ------------ | ------------- | ------------ |
| **Pub/Sub**  | 消息实时推送  | 低延迟       |
| **连接池**   | 复用连接      | 减少连接开销 |
| **数据结构** | String + Hash | 高效存储     |

---

## 🚀 优化建议

### 客户端优化

```javascript
// 推荐：使用 SSE 自动重连
const eventSource = new EventSource('/api/subscribe?channel=my-channel');

eventSource.onerror = error => {
  console.log('连接断开，自动重连...');
  // 浏览器自动重连，无需手动处理
};

// 推荐：批量发布消息
const messages = [
  { channel: 'ch1', message: 'msg1' },
  { channel: 'ch1', message: 'msg2' },
  // ...
];
// 使用 Promise.all 并行发布
await Promise.all(messages.map(m => publishMessage(m)));
```

**客户端最佳实践：**

- ✅ 复用 SSE 连接，避免频繁重连
- ✅ 批量发布消息，减少请求次数
- ✅ 实现指数退避重试策略
- ✅ 使用 `keepalive` 心跳保活
- ❌ 不要创建大量并发 SSE 连接

### 服务端优化

```typescript
// 推荐：使用连接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲超时
  connectionTimeoutMillis: 2000, // 连接超时
});

// 推荐：批量操作
await db.insert(messages).values([
  { channelId: 'ch1', content: 'msg1' },
  { channelId: 'ch1', content: 'msg2' },
  // ...
]);
```

**服务端最佳实践：**

- ✅ 配置合理的连接池大小
- ✅ 使用批量操作减少数据库往返
- ✅ 启用 Redis 缓存热点数据
- ✅ 监控慢查询并优化
- ❌ 不要在循环中执行数据库查询

### 基础设施优化

| 优化项         | 建议                   | 收益         |
| -------------- | ---------------------- | ------------ |
| **区域部署**   | 选择靠近用户的区域     | 降低延迟     |
| **CDN**        | 静态资源使用 CDN       | 加速内容分发 |
| **自动扩缩容** | 根据负载自动调整实例数 | 应对流量峰值 |
| **负载均衡**   | 多实例负载均衡         | 提高可用性   |

---

## 📈 监控与观测

### 关键指标

| 指标                 | 类型      | 说明               |
| -------------------- | --------- | ------------------ |
| `request_duration`   | Histogram | 请求耗时分布       |
| `active_connections` | Gauge     | 当前 SSE 连接数    |
| `cache_hit_ratio`    | Gauge     | 缓存命中率         |
| `db_pool_usage`      | Gauge     | 数据库连接池使用率 |
| `redis_latency`      | Histogram | Redis 操作延迟     |

### 日志记录

```typescript
// 结构化日志
logger.info({
  event: 'message_published',
  channel: 'my-channel',
  priority: 'high',
  duration: 45,
  messageSize: 1024,
});
```

### 健康检查

| 端点          | 说明     | 检查项          |
| ------------- | -------- | --------------- |
| `/api/health` | 存活检查 | 进程状态        |
| `/api/ready`  | 就绪检查 | DB + Redis 连接 |

---

## 🔧 性能调优 Checklist

- [ ] 配置合理的数据库连接池大小
- [ ] 启用 Redis 缓存热点数据
- [ ] 配置合理的缓存 TTL
- [ ] 优化数据库索引
- [ ] 配置合理的限流阈值
- [ ] 启用 Gzip 压缩
- [ ] 配置合理的超时时间
- [ ] 启用请求日志记录
- [ ] 配置监控与告警
- [ ] 定期进行性能基准测试

---

**[📖 用户指南](USER_GUIDE.md)** • **[🏗️ 架构文档](ARCHITECTURE.md)** • **[🏠 返回首页](../README.md)**
