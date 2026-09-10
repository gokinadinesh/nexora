# NEXORA — Production Deployment & Operations Guide

> **"Enter the Grid. Outsmart the Network."**  
> Operational guide for deploying, configuring, and maintaining the NEXORA real-time multiplayer platform in production.

---

## 1. Prerequisites & System Requirements

| Component | Minimum | Recommended |
| --- | --- | --- |
| **Operating System** | Ubuntu 22.04 LTS / Debian 12 / Alpine 3.19 | Ubuntu 24.04 LTS |
| **Node.js** | 20.x LTS | 20.18+ LTS |
| **Docker Engine** | 24.x | 26.x+ with Compose v2 |
| **PostgreSQL** | 15.x | 16.x Alpine |
| **Memory** | 1 GB RAM (Server + DB) | 2 GB+ RAM |
| **Storage** | 10 GB SSD | 20 GB+ NVMe |

---

## 2. Environment Configuration Checklist

Before launching NEXORA in production, verify the following configuration variables:

```bash
# 1. Server & Networking
PORT=4000
NODE_ENV=production
CLIENT_URL=https://nexora.yourdomain.com
CORS_ORIGINS=https://nexora.yourdomain.com

# 2. Database (Replace with secure credentials)
DATABASE_URL=postgresql://nexora_user:STRONG_PASSWORD_HERE@postgres:5432/nexora
USE_MEMORY_DB=false

# 3. Security (MUST be high-entropy, >= 32 characters)
JWT_SECRET=GENERATED_32_CHAR_CRYPTOGRAPHIC_SECRET_HERE
OPERATOR_SECRET=GENERATED_OPERATOR_SECRET_FOR_PROMOTIONS
OPERATOR_USERNAMES=ops_admin,lead_architect

# 4. Protection Limits
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
BODY_LIMIT=100kb
```

> [!IMPORTANT]
> **Refusal to Start on Insecure Configuration**: The NEXORA server will deliberately terminate during bootstrap (`process.exit(1)`) if `NODE_ENV=production` is active and `JWT_SECRET` matches development defaults or is under 16 characters.

---

## 3. Deployment Methods

### Option 0: 1-Click Cloud PaaS (Render / Railway) [Fastest & Easiest]

NEXORA includes native configuration for zero-setup cloud deployments on Render and Railway with automatic HTTPS, live WebSockets, and managed PostgreSQL:

#### Deploying on Render

1. **Push your code to GitHub** (public or private repository).
2. Go to your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Connect your GitHub repository.
5. Render detects [`render.yaml`](file:///e:/NEX/render.yaml) and automatically creates:
   - `nexora-postgres` (Managed PostgreSQL database)
   - `nexora-app` (Web service running Node.js + React SPA + Socket.IO)
6. Click **Apply**.
7. In ~2 minutes, your NEXORA platform is live at `https://nexora-app.onrender.com`!

#### Deploying on Railway

1. Push your repository to GitHub.
2. Go to [Railway.app](https://railway.app) and create a **New Project**.
3. Select **Deploy from GitHub repo** and choose your repository.
4. Click **+ New** -> **Database** -> **Add PostgreSQL**.
5. In your web service settings, add `DATABASE_URL` referencing the Postgres service, and set `JWT_SECRET` (>= 32 chars).
6. Click **Deploy**. Railway will run `npm run build` and `npm start`.

---

### Option A: Docker Compose (Local / VPS)

1. **Clone repository and configure environment:**

   ```bash
   git clone https://github.com/nexora/nexora.git /opt/nexora
   cd /opt/nexora
   cp .env.example .env
   # Edit .env with your production secrets
   nano .env
   ```

2. **Build and start containers:**

   ```bash
   docker compose up -d --build
   ```

3. **Verify running services:**

   ```bash
   docker compose ps
   docker compose logs -f app
   ```

4. **Run migrations:**
   Migrations are automatically applied on container startup if tables do not exist. To manually apply:

   ```bash
   docker compose exec app npm run db:migrate
   ```

---

### Option B: Bare-Metal / Virtual Machine (Systemd + PM2)

1. **Build monorepo:**

   ```bash
   npm ci
   npm run build
   ```

2. **Configure PM2 process manager:**
   Create `ecosystem.config.cjs`:

   ```javascript
   module.exports = {
     apps: [
       {
         name: 'nexora-server',
         script: 'server/dist/server.js',
         instances: 1, // Single instance for Stage 8 in-memory state cohesion
         autorestart: true,
         watch: false,
         max_memory_restart: '1G',
         env_production: {
           NODE_ENV: 'production',
           PORT: 4000,
         },
       },
     ],
   };
   ```

3. **Start with PM2:**

   ```bash
   pm2 start ecosystem.config.cjs --env production
   pm2 save
   pm2 startup
   ```

---

## 4. Nginx Reverse Proxy with WebSocket Upgrades

To serve NEXORA securely under HTTPS/WSS, use the following Nginx virtual host configuration:

```nginx
server {
    listen 80;
    server_name nexora.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name nexora.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/nexora.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nexora.yourdomain.com/privkey.pem;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Client payload size limit
    client_max_body_size 100k;

    # REST API & SPA fallback
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO WebSocket Engine
    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 5. Health & Readiness Probes

NEXORA exposes two standardized endpoints for container orchestrators and uptime monitors:

| Probe | Endpoint | Purpose | Expected Status Code |
| --- | --- | --- | --- |
| **Liveness** | `GET /api/health` | Verifies process responsiveness | `200 OK` |
| **Readiness** | `GET /api/ready` | Verifies PostgreSQL connectivity and ensures instance is not draining connections | `200 OK` (ready) or `503 Service Unavailable` (not ready) |

### Kubernetes Probe Configuration Example

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 4000
  initialDelaySeconds: 10
  periodSeconds: 15
readinessProbe:
  httpGet:
    path: /api/ready
    port: 4000
  initialDelaySeconds: 5
  periodSeconds: 10
```

---

## 6. Graceful Shutdown & Zero-Downtime Rollouts

When `SIGTERM` or `SIGINT` is received by the Node.js process:

1. `setServerShuttingDown(true)` triggers immediate `503` responses on `/api/ready`.
2. Load balancers detach the instance from the routing pool.
3. The matchmaking queue is drained.
4. Active Socket.IO connections are cleanly notified and closed.
5. In-flight database transactions are completed, and the connection pool is cleanly terminated.
6. The process exits with code `0`.
