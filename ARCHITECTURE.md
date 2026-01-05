# Architecture Documentation

## 1. System Context

**SecureNotify** is a secure, real-time message notification system. It allows users to create public or encrypted channels and publish/subscribe to messages via HTTP/SSE.

### External Dependencies
- **PostgreSQL**: Primary data store for persistent channels and public keys.
- **Redis**: Message queue, temporary channel metadata, and Pub/Sub mechanism.
- **Clients**: Web browsers or API clients consuming the notification service.

## 2. Container View

The system consists of the following containers:

- **Web Application (Next.js)**:
  - Serves the frontend UI.
  - Exposes REST APIs for message publishing and channel management.
  - Manages SSE connections for real-time delivery.
  - **Tech Stack**: Next.js 16 (React), TypeScript.

- **Database (PostgreSQL)**:
  - Stores `Channel` entities (persistent).
  - Stores `PublicKey` entities for encryption.
  - **Managed Service**: Huawei Cloud RDS / Vercel Postgres.

- **Cache/Queue (Redis)**:
  - Stores temporary channel metadata (TTL).
  - Acts as a Priority Queue for messages.
  - Handles Pub/Sub for real-time distribution.
  - **Managed Service**: Huawei Cloud DCS / Vercel KV.

## 3. Deployment View (Huawei Cloud)

This architecture describes the deployment on Huawei Cloud FunctionGraph.

```mermaid
graph TD
    Client[Client] --> APIG[API Gateway]
    APIG --> FG[FunctionGraph<br>(Next.js Container)]
    FG --> RDS[RDS for PostgreSQL]
    FG --> DCS[DCS for Redis]
    SWR[SWR Image Registry] -.->|Pull Image| FG
```

### Components
1.  **FunctionGraph**: Runs the Next.js application as a custom container.
    -   **Runtime**: Custom Image (Node.js 20 based).
    -   **Scaling**: Auto-scaling based on request volume.
2.  **API Gateway (APIG)**: Entry point for external traffic.
    -   Triggers the function.
    -   Handles SSL termination.
3.  **SWR (SoftWare Repository)**: Stores the Docker image.
4.  **RDS**: Managed PostgreSQL instance.
5.  **DCS**: Managed Redis instance.

## 4. Key Decisions

- **Container Deployment**: Chosen over standard zip deployment to support Next.js 16 complexities and dependency management.
- **Serverless Database**: Usage of connection pooling or serverless-friendly drivers (like `@vercel/postgres` or `pg-pool`) is critical to manage connection limits.
- **SSE Limitations**: FunctionGraph APIG triggers have timeouts. For production-grade long-lived connections, consider using APIG WebSocket support or dedicated compute (ECS/CCI), though SSE can work with client-side reconnection logic.
