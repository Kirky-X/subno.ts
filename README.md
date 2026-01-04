# SecureNotify - Encrypted Push Notification Service

A secure, end-to-end encrypted push notification service built with Next.js, PostgreSQL, Redis, and RSA/AES encryption.

## Features

- 🔐 **End-to-End Encryption** - RSA-2048 + AES-GCM hybrid encryption
- 🚀 **Real-time Subscriptions** - Server-Sent Events (SSE) for instant delivery
- 📊 **Priority Queues** - Redis sorted sets for message prioritization
- 🛡️ **Rate Limiting** - Sliding window algorithm to prevent abuse
- 📝 **Audit Logging** - Complete audit trail of all operations
- 🧪 **Comprehensive Tests** - 67+ unit and integration tests

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Next.js    │────▶│  PostgreSQL │
│ (Publisher) │     │   API       │     │  (Schema)   │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                   ┌─────────────┐     ┌─────────────┐
                   │    Redis    │◀────│  Subscriber │
                   │ (Queues)    │     │   (SSE)     │
                   └─────────────┘     └─────────────┘
```

## Quick Start

### 1. Start Infrastructure

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 2. Configure Environment

```bash
# Copy example environment
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `ALLOWED_ORIGINS` - CORS origins (comma-separated)

### 3. Initialize Database

```bash
# Generate migrations
npm run db:generate

# Push schema to database
npm run db:push
```

### 4. Run Development Server

```bash
npm run dev
```

Server runs at http://localhost:3000

## API Endpoints

### Publish Message
```http
POST /api/publish
Content-Type: application/json

{
  "channelId": "channel_123",
  "payload": "encrypted_message",
  "priority": 10,
  "ttl": 3600
}
```

### Subscribe to Channel
```http
GET /api/subscribe?channelId=channel_123
Content-Type: text/event-stream
```

### Register Public Key
```http
POST /api/register
Content-Type: application/json

{
  "channelId": "channel_123",
  "publicKey": "-----BEGIN PUBLIC KEY-----..."
}
```

### Get Public Key
```http
GET /api/keys/{channelId}
```

### Delete Public Key
```http
DELETE /api/keys/{id}
Authorization: Bearer {api_key}
```

### List Channels
```http
GET /api/channels?limit=10&offset=0
```

### Cleanup Cron Jobs
```bash
# Clean expired keys (daily)
node src/app/api/cron/cleanup-keys/route.ts expired-keys

# Clean old audit logs (weekly)
node src/app/api/cron/cleanup-keys/route.ts audit-logs 30

# Clean old messages (hourly)
node src/app/api/cron/cleanup-keys/route.ts messages 12

# Clean orphaned queues (daily)
node src/app/api/cron/cleanup-keys/route.ts orphaned-queues
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/unit/encryption.service.test.ts
```

## Building for Production

```bash
# Build production bundle
npm run build

# Start production server
npm start
```

## Deployment Options

### Docker

```bash
# Build image
docker build -t securenotify .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  securenotify
```

### Vercel

1. Connect repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically

### Railway

1. Create new project on Railway
2. Add PostgreSQL and Redis plugins
3. Connect repository and deploy

## Security Considerations

- All messages encrypted with AES-GCM
- Public keys registered with RSA-2048
- Rate limiting per IP/API key
- CORS with IP validation
- Security headers on all responses
- Audit logging for all operations

## Performance

- O(log N + M) priority queue operations
- Connection pooling for database
- Redis connection management for serverless
- Batch processing for cleanup jobs

## License

MIT