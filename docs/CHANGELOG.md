# 📋 更新日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.2] - 2026-01-15

### 新增

- 两阶段密钥撤销机制：`POST /api/keys/[id]/revoke` 生成确认码，`DELETE /api/keys/[id]` 确认执行
- 撤销请求取消功能：`POST /api/keys/[id]/revoke/cancel`
- Cron 定时清理任务：`/api/cron/cleanup-channels`（每天 02:00）、`/api/cron/cleanup-keys`（每天 03:30）
- 审计日志服务：记录所有关键操作，支持事后追溯
- 安全响应头：`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`

### 变更

- 升级 Next.js 至 16.1.1
- 升级 TypeScript 至 5.x
- 升级 Zod 至 4.6.5
- 优化 Redis 连接池管理
- 优化 PostgreSQL 查询性能

### 修复

- 修复 SSE 连接内存泄漏问题
- 修复高并发下 Redis 连接耗尽问题
- 修复时区处理不一致问题

---

## [0.2.0] - 2025-12-20

### 新增

- Server-Sent Events (SSE) 实时消息订阅：`GET /api/subscribe`
- 消息优先级队列：CRITICAL/HIGH/NORMAL/LOW/BULK 五级优先级
- Redis Pub/Sub 消息总线：支持多实例消息同步
- 请求速率限制：IP 与 User-Agent 双重限流
- API 密钥权限分级：read/write/admin 三级权限

### 变更

- 重构消息发布流程，支持优先级排序
- 优化数据库索引，提升查询性能
- 改进错误处理机制，统一错误响应格式

### 修复

- 修复频道自动过期逻辑
- 修复消息队列并发写入冲突

---

## [0.1.0] - 2025-11-10

### 新增

- 初始版本发布
- 公钥注册与管理：`POST /api/register`、`GET /api/register`
- 频道管理：`POST /api/channels`、`GET /api/channels`
- 消息发布：`POST /api/publish`、`GET /api/publish`
- 健康检查：`GET /api/health`、`GET /api/ready`
- 混合加密架构：RSA + AES-256-GCM
- 多算法支持：RSA-2048、RSA-4096、ECC-SECP256K1
- Vercel 自动部署配置
- Docker 容器化支持

---

## 版本说明

|  版本号格式  | 说明                 |
| :----------: | :------------------- |
| **主版本号** | 不兼容的 API 修改    |
| **次版本号** | 向下兼容的功能性新增 |
|  **修订号**  | 向下兼容的问题修正   |

---

**[📖 用户指南](USER_GUIDE.md)** • **[🏠 返回首页](../README.md)**
