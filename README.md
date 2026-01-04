<div align="center">

# 🔔 subno.ts

<p>
  <img src="https://img.shields.io/badge/version-0.1.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-Apache--2.0-green.svg" alt="License">
</p>

<p align="center">
  <strong>加密推送通知服务 - 公钥存储与消息分发</strong>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-文档">文档</a> •
  <a href="#-api-参考">API 参考</a>
</p>

</div>

---

## 📋 目录

<details open>
<summary>点击展开</summary>

- [✨ 功能特性](#-功能特性)
- [🎯 使用场景](#-使用场景)
- [🚀 快速开始](#-快速开始)
  - [环境要求](#环境要求)
  - [安装部署](#安装部署)
  - [配置说明](#配置说明)
- [📚 文档](#-文档)
- [🛠️ 技术栈](#️-技术栈)
- [🤝 贡献](#-贡献)
- [📄 许可证](#-许可证)

</details>

---

## ✨ 功能特性

<table>
<tr>
<td width="50%">

### 🔑 核心功能

- **公钥注册** - 注册和存储加密公钥
- **频道管理** - 创建和管理推送频道
- **消息推送** - 发布消息到频道
- **实时订阅** - Server-Sent Events 实时接收消息

</td>
<td width="50%">

### 🛡️ 安全特性

- **请求限流** - 防止 API 滥用
- **审计日志** - 记录所有操作
- **API 密钥认证** - 管理 API 访问权限
- **自动清理** - 过期密钥和频道自动清理

</td>
</tr>
</table>

---

## 🎯 使用场景

- **端到端加密通信** - 客户端通过服务端交换公钥
- **实时消息推送** - Server-Sent Events 实时推送
- **加密通知系统** - 安全的消息通知服务
- **密钥分发中心** - 集中管理加密密钥

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose（可选）

### 安装部署

**方式一：Docker Compose（推荐）**

```bash
# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

**方式二：手动部署**

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 运行数据库迁移
npm run db:migrate

# 启动开发服务器
npm run dev

# 或构建生产版本
npm run build
npm start
```

### 配置说明

创建 `.env` 文件：

```env
# 数据库
DATABASE_URL=postgresql://securenotify:securenotify@localhost:5432/securenotify

# Redis
REDIS_URL=redis://localhost:6379

# API 配置
NODE_ENV=development
PORT=3000

# 限流配置
RATE_LIMIT_PUBLISH=100
RATE_LIMIT_SUBSCRIBE=50
RATE_LIMIT_REGISTER=10

# 安全配置
CRON_SECRET=your-cron-secret-here
```

---

## 📚 文档

<div align="center">

<table>
<tr>
<td align="center" width="25%">
<a href="USER_GUIDE.md">
<img src="https://img.icons8.com/fluency/96/000000/book.png" width="64" height="64"><br>
<b>用户指南</b>
</a><br>
完整使用指南
</td>
<td align="center" width="25%">
<a href="API_REFERENCE.md">
<img src="https://img.icons8.com/fluency/96/000000/api.png" width="64" height="64"><br>
<b>API 参考</b>
</a><br>
完整 API 文档
</td>
<td align="center" width="25%">
<a href="ARCHITECTURE.md">
<img src="https://img.icons8.com/fluency/96/000000/blueprint.png" width="64" height="64"><br>
<b>架构设计</b>
</a><br>
系统设计文档
</td>
<td align="center" width="25%">
<a href="FAQ.md">
<img src="https://img.icons8.com/fluency/96/000000/help.png" width="64" height="64"><br>
<b>常见问题</b>
</a><br>
FAQ 解答
</td>
</tr>
</table>

</div>

---

## 🛠️ 技术栈

<table>
<tr>
<th>类别</th>
<th>技术</th>
<th>用途</th>
</tr>
<tr>
<td>运行时</td>
<td>Node.js 18+</td>
<td>JavaScript 运行环境</td>
</tr>
<tr>
<td>框架</td>
<td>Next.js 16</td>
<td>React 框架 + App Router</td>
</tr>
<tr>
<td>数据库</td>
<td>PostgreSQL + Drizzle ORM</td>
<td>主数据存储</td>
</tr>
<tr>
<td>缓存/消息</td>
<td>Redis</td>
<td>缓存 + 实时消息</td>
</tr>
<tr>
<td>语言</td>
<td>TypeScript</td>
<td>类型安全</td>
</tr>
<tr>
<td>验证</td>
<td>Zod</td>
<td>Schema 验证</td>
</tr>
</table>

---

## 🤝 贡献

欢迎贡献代码！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

---

## 📄 许可证

本项目采用 Apache License 2.0 许可证。

---

<div align="center">

**Built with ❤️ by Kirky.X**

[⬆ 返回顶部](#-subnots)

</div>
