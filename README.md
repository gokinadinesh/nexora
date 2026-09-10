# NEXORA

> **"Enter the Grid. Outsmart the Network."**

NEXORA is a real-time multiplayer competitive cyber-strategy game designed to demonstrate serious multiplayer infrastructure.

## Project Structure

```text
nexora/
├── client/          # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── context/
│   │   ├── utils/
│   │   └── assets/
│   └── package.json
│
├── server/          # Node.js + Express + TypeScript + Socket.IO backend
│   ├── src/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── sockets/
│   │   ├── game/
│   │   └── utils/
│   └── package.json
│
├── shared/          # Shared constants, contracts, and TypeScript types
│   ├── constants/
│   └── types/
│
├── README.md
├── .gitignore
└── package.json
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `server/.env`:
```bash
cp .env.example server/.env
```

### 3. Run Backend Server
```bash
npm run dev:server
```
Server runs at `http://localhost:4000` (Health check: `GET /api/health`).

### 4. Run Frontend Client
```bash
npm run dev:client
```
Client runs at `http://localhost:5173`.
