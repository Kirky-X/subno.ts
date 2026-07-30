<div align="center">

<span id="-securenotify-subnots"></span>

<img src="public/assets/logo.png" alt="SecureNotify Logo" height="100" />

<h3 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 1.8rem; margin: 0.5rem 0;">
  Encrypted Push Notification Service
</h3>

<p style="color: #6b7280; margin: 0;">
  Public Key Storage & Message Distribution
</p>

---

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.9.0-339933?logo=node.js&style=flat-square&logoColor=fff)](https://nodejs.org)[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&style=flat-square&logoColor=fff)](https://nextjs.org)[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&style=flat-square&logoColor=fff)](https://typescriptlang.org)[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=flat-square)](LICENSE)

---

[🚀 Quick Start](#-quick-start) • [📖 API Reference](docs/API_REFERENCE.md) • [🏗️ Architecture](docs/ARCHITECTURE.md) • [📚 User Guide](docs/USER_GUIDE.md) • [📕 README 中文](./README.md)

</div>

---

## 💡 Introduction

> **SecureNotify** (subno.ts) is an encrypted push notification service focused on public key storage and message distribution. It provides end-to-end encrypted communication, real-time message push, and key management capabilities, ensuring maximum security protection for your messages in transit.

---

## ✨ Core Features

| Feature                                     | Status  | Description                                                                                                   |
| ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| **🔐 Public Key Registration & Management** | ✅ Done | Register, store, and query public keys for multiple encryption algorithms (RSA-2048, RSA-4096, ECC-SECP256K1) |
| **📢 Channel Management**                   | ✅ Done | Supports public, encrypted, and ephemeral channel types for different scenarios                               |
| **⚡ Real-time Message Push**               | ✅ Done | Real-time message distribution via Server-Sent Events (SSE), instant delivery to subscribers                  |
| **🔒 Message Encryption**                   | ✅ Done | Hybrid encryption architecture (RSA + AES-256-GCM) with end-to-end encryption support                         |
| **🛡️ Security Controls**                    | ✅ Done | API key authentication, rate limiting, audit logging, input validation, and more                              |
| **🎯 Message Priority**                     | ✅ Done | Priority queue (CRITICAL/HIGH/NORMAL/LOW/BULK) ensures critical messages are processed first                  |
| **🔑 Two-Phase Revocation**                 | ✅ Done | Key revocation uses a two-phase confirmation mechanism to prevent accidental operations                       |

---

## 🛠️ Tech Stack

<div style="display: flex; flex-direction: column; gap: 0.5rem;">

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.9.0-339933?logo=node.js)](https://nodejs.org) [![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://typescriptlang.org) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-336791?logo=postgresql)](https://www.postgresql.org) [![Redis](https://img.shields.io/badge/Redis-7+-DC382D?logo=redis)](https://redis.io) [![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-0.45.1-6291c5)](https://orm.drizzle.team) [![Zod](https://img.shields.io/badge/Zod-4.4.3-c42427)](https://zod.dev)

</div>

---

## 🚀 Quick Start

### Prerequisites

- ✅ Node.js >= 20.9.0
- ✅ PostgreSQL 14+
- ✅ Redis 7+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/subno.ts.git
cd subno.ts

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

### Environment Configuration

```env
DATABASE_URL=postgresql://user:password@localhost:5432/securenotify
REDIS_URL=redis://localhost:6379
ADMIN_MASTER_KEY=your-secure-master-key
CRON_SECRET=your-cron-secret
```

> ⚠️ **Important**: In production, `ADMIN_MASTER_KEY` and `CRON_SECRET` must be set and at least 32 characters long.

### Running

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Run tests
npm test
```

---

## 📁 Project Structure

```
subno.ts/
├── app/                    # Next.js App Router
│   ├── api/               # API endpoints
│   │   └── keys/          # Key management ✅ Done
│   │       ├── [id]/           # Key operations
│   │       └── [id]/revoke/    # Two-phase revocation
│   ├── components/        # React components
│   └── api-docs/          # API documentation page
├── src/
│   ├── config/            # Configuration files
│   ├── db/                # Database schema
│   └── lib/               # Core libraries
│       ├── services/      # Business logic
│       ├── repositories/  # Data access
│       └── middleware/    # Middleware
├── sdk/                   # Multi-language SDK
│   ├── typescript/        # TypeScript SDK
│   ├── python/            # Python SDK
│   ├── rust/              # Rust SDK
│   ├── java/              # Java SDK
│   └── c/                 # C SDK
├── docs/                   # Documentation
├── __tests__/              # Tests
└── scripts/                # Script utilities
```

---

## 🔌 API Overview

### API Implementation Status

| API Endpoint                   | Method    | Status  | Description                                      |
| ------------------------------ | --------- | ------- | ------------------------------------------------ |
| `/api/health`                  | GET       | ✅ Done | Liveness probe                                   |
| `/api/ready`                   | GET       | ✅ Done | Readiness probe (with DB/Redis dependency check) |
| `/api/keys/[id]`               | DELETE    | ✅ Done | Key deletion (two-phase confirmation)            |
| `/api/keys/[id]/revoke`        | POST, GET | ✅ Done | Request/query key revocation                     |
| `/api/keys/[id]/revoke/cancel` | POST      | ✅ Done | Cancel revocation request                        |
| `/api/register`                | POST, GET | ✅ Done | Public key registration and query                |
| `/api/channels`                | POST, GET | ✅ Done | Channel creation and query                       |
| `/api/publish`                 | POST, GET | ✅ Done | Message publishing and queue status              |
| `/api/subscribe`               | GET (SSE) | ✅ Done | Real-time message subscription                   |
| `/api/cron/cleanup-channels`   | GET       | ✅ Done | Channel cleanup                                  |
| `/api/cron/cleanup-keys`       | GET       | ✅ Done | Key cleanup                                      |

### Implemented API Examples

#### Key Revocation Request

```bash
POST /api/keys/enc_xxx/revoke
X-API-Key: your-api-key
Content-Type: application/json

{
  "reason": "Key rotation required",
  "confirmationHours": 24
}
```

#### Confirm Key Revocation

```bash
DELETE /api/keys/enc_xxx?confirmationCode=xxxxxx
X-API-Key: your-api-key
```

### More API Examples

<details>
<summary>📋 Click to view API examples</summary>

#### Public Key Registration

```bash
POST /api/register
Content-Type: application/json

{
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "algorithm": "RSA-4096",
  "expiresIn": 604800
}
```

#### Channel Management

```bash
POST /api/channels
Content-Type: application/json

{
  "name": "my-channel",
  "type": "public"
}
```

#### Message Publishing

```bash
POST /api/publish
Content-Type: application/json

{
  "channel": "my-channel",
  "message": "Hello, World!",
  "priority": "normal"
}
```

#### Real-time Subscription

```bash
GET /api/subscribe?channel=my-channel
```

</details>

📖 See the [API Reference](docs/API_REFERENCE.md) for detailed API documentation.

---

## 💡 Core Concepts

### Channel Types

| Type      | Description                   | Encrypted | Icon |
| --------- | ----------------------------- | --------- | ---- |
| Public    | Accessible by all subscribers | ❌        | 🌐   |
| Encrypted | End-to-end encrypted          | ✅        | 🔒   |
| Ephemeral | Auto-expiring                 | ❌/✅     | ⏱️   |

### Message Priorities

| Priority | Value | Description      | Color |
| -------- | ----- | ---------------- | ----- |
| CRITICAL | 100   | Highest priority | 🔴    |
| HIGH     | 75    | High priority    | 🟠    |
| NORMAL   | 50    | Default priority | 🟡    |
| LOW      | 25    | Low priority     | 🟢    |
| BULK     | 0     | Bulk messages    | ⚪    |

---

## 📚 Documentation

| Document                                  | Description                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| [📖 API Reference](docs/API_REFERENCE.md) | Complete API endpoint documentation with request/response examples and error codes |
| [📚 User Guide](docs/USER_GUIDE.md)       | Product overview, core concepts, usage examples, security best practices           |
| [🏗️ Architecture](docs/ARCHITECTURE.md)   | System architecture, data flow, security design, performance considerations        |

---

## 🤝 Contributing

1. 🍴 Fork the repository
2. 🌿 Create a feature branch: `git checkout -b feature/your-feature`
3. ✏️ Commit your changes: `git commit -m 'Add: your feature'`
4. 📤 Push to the branch: `git push origin feature/your-feature`
5. 🔀 Create a Pull Request

---

## 📄 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

---

## 📞 Contact

- **📦 Repository**: https://github.com/your-org/subno.ts
- **🐛 Issues**: https://github.com/your-org/subno.ts/issues

---

<div align="center">

**SecureNotify** - Secure, real-time, reliable push notification service

Made with ❤️ by [Kirky.X](https://github.com/KirkyX)

---

[⬆️ Back to top](#-securenotify-subnots)

</div>

---

<div align="center">

_© 2026 SecureNotify. All rights reserved._

</div>
