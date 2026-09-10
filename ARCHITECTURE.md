# NEXORA — System Architecture & Scalability Blueprint

> **"Enter the Grid. Outsmart the Network."**  
> NEXORA is a real-time multiplayer competitive cyber-strategy game engineered to showcase production-grade multiplayer infrastructure: server-authoritative state resolution, cryptographic telemetry, operational monitoring, and horizontal scalability.

---

## 1. High-Level System Architecture

NEXORA operates as a modular TypeScript monorepo with strict separation of concerns across shared contracts, frontend presentation, backend business logic, and server-authoritative game simulation.

```mermaid
graph TB
    subgraph Client Tier ["Client Tier (Browser / Operative UI)"]
        UI["React 18 + Vite SPA"]
        SocketClient["Socket.IO Client (WSS)"]
        HTTPClient["Fetch / REST API Client"]
    end

    subgraph Edge Tier ["Edge & Network Layer"]
        LB["Reverse Proxy / Load Balancer (Nginx / ALB)"]
        SecHeaders["Security Headers & In-Memory Rate Limiting"]
    end

    subgraph Application Tier ["Application Tier (Node.js Server)"]
        Express["Express 4 REST Engine"]
        SocketServer["Socket.IO Engine (4.8.x)"]
        AuthService["JWT Authentication & RBAC"]
        MatchmakingService["Rating-Aware Matchmaking Queue"]
        GameEngine["5x5 CyberGrid Real-Time Engine"]
        SessionService["Active Match Session Manager"]
        MonitoringService["Metrics, Events & Anomaly Services"]
    end

    subgraph Persistence Tier ["Data Tier (PostgreSQL 16)"]
        PG["PostgreSQL Connection Pool (pg)"]
        UsersTable[("users")]
        MatchesTable[("matches & match_players")]
        StatesTable[("game_states")]
        AuditTable[("match_events")]
    end

    UI --> HTTPClient
    UI --> SocketClient
    HTTPClient --> LB
    SocketClient --> LB
    LB --> SecHeaders
    SecHeaders --> Express
    SecHeaders --> SocketServer
    Express --> AuthService
    Express --> MatchmakingService
    SocketServer --> SessionService
    SessionService --> GameEngine
    GameEngine --> MonitoringService
    AuthService --> PG
    GameEngine --> PG
    MonitoringService --> Express
    PG --> UsersTable
    PG --> MatchesTable
    PG --> StatesTable
    PG --> AuditTable
```

---

## 2. Real-Time Event & Authoritative Action Flow

NEXORA adheres to the **server-authoritative multiplayer pattern**. Clients never dictate state changes or calculate scores; they transmit player intent (`PLAYER_ACTION`), which the server validates against game rules, turn order, spatial grid connectivity, action idempotency, and rate limits.

```mermaid
sequenceDiagram
    autonumber
    actor OperativeA as Operative A (Socket)
    participant Server as NEXORA Server
    participant Engine as 5x5 CyberGrid Engine
    participant DB as PostgreSQL
    actor OperativeB as Operative B (Socket)

    OperativeA->>Server: PLAYER_ACTION { actionId, type: "CAPTURE", targetNodeId: 12 }
    Server->>Server: Rate Limit Check (6 actions / sec)
    Server->>Server: Idempotency Check (actionId deduplication)
    Server->>Engine: processAction(matchId, userId, action)
    
    alt Invalid Action (Rule violation / Out of turn / Rate limited)
        Engine-->>Server: Error (e.g., NOT_YOUR_TURN / INVALID_TARGET)
        Server-->>OperativeA: ACTION_REJECTED { actionId, code, reason }
        Server->>Server: Record Security & Anomaly Telemetry
    else Valid Action
        Engine->>Engine: Mutate grid, update turn, increment scores, bump version
        Engine-->>Server: { state, actionResult, isGameOver }
        Server->>OperativeA: NODE_CAPTURED { targetNodeId: 12, scoreDelta: 10 }
        Server->>OperativeB: NODE_CAPTURED { targetNodeId: 12, scoreDelta: 10 }
        Server->>OperativeA: SCORE_UPDATED { playerId, score }
        Server->>OperativeB: SCORE_UPDATED { playerId, score }
        Server->>OperativeA: GAME_STATE_UPDATED (authoritative snapshot v+1)
        Server->>OperativeB: GAME_STATE_UPDATED (authoritative snapshot v+1)
        
        opt Game Over Condition Met (Node threshold or turns exhausted)
            Server->>DB: finalizeMatch (Winner, ELO ratings, stats, final state)
            Server->>OperativeA: GAME_ENDED { winnerId, state, result }
            Server->>OperativeB: GAME_ENDED { winnerId, state, result }
        end
    end
```

---

## 3. Current Single-Instance Architecture & Scaling Boundaries

In the Stage 8 baseline, NEXORA operates as a single high-performance Node.js service running in conjunction with PostgreSQL. This architecture has intentional boundaries:

| Subsystem | Current In-Memory State | Single-Instance Scaling Boundary |
| --- | --- | --- |
| **Matchmaking** | `waitingQueue: QueueEntry[]` in RAM | Players connected to separate Node processes cannot be paired together. |
| **Active Game Sessions** | `ActiveMatchSession` map in RAM | Player A and Player B in the same match must be connected to the exact same server instance. |
| **Presence & Lobby** | `userSockets` and `socketUsers` maps | Presence broadcasts only reach sockets connected to the local instance. |
| **Telemetry & Metrics** | Sliding windows in RAM (`actionTimestamps`, `actionLatencySamples`) | Telemetry dashboard reflects node-local stats rather than fleet-wide aggregate stats. |

---

## 4. Horizontal Scaling Roadmap (Production Architecture)

To scale NEXORA to thousands of concurrent matches across a cluster of containerized nodes, the following incremental architecture is planned:

```mermaid
graph TB
    subgraph Clients ["Operative Clients"]
        C1["Client 1"]
        C2["Client 2"]
        C3["Client 3"]
    end

    subgraph Ingress ["Edge & Gateway Tier"]
        ALB["AWS ALB / Nginx (Sticky Session or Path-Routed)"]
    end

    subgraph Cluster ["NEXORA Game Server Fleet"]
        N1["Server Node 1 (Socket.IO + Engine)"]
        N2["Server Node 2 (Socket.IO + Engine)"]
        N3["Server Node 3 (Socket.IO + Engine)"]
    end

    subgraph StateBus ["Distributed State & Coordination Layer"]
        RedisPubSub[("Redis Pub/Sub<br/>(@socket.io/redis-adapter)")]
        RedisQueue[("Redis Queue / Redlock<br/>(Matchmaking & Locks)")]
        Kafka[("Kafka / Redpanda Event Stream<br/>(Audit Logs & Telemetry)")]
    end

    subgraph Storage ["Persistent Database Tier"]
        AuroraPG[("PostgreSQL Aurora Primary")]
        ReadReplica[("PostgreSQL Read Replicas")]
    end

    C1 --> ALB
    C2 --> ALB
    C3 --> ALB
    ALB --> N1
    ALB --> N2
    ALB --> N3

    N1 <--> RedisPubSub
    N2 <--> RedisPubSub
    N3 <--> RedisPubSub

    N1 <--> RedisQueue
    N2 <--> RedisQueue
    N3 <--> RedisQueue

    N1 --> Kafka
    N2 --> Kafka
    N3 --> Kafka

    N1 --> AuroraPG
    N2 --> AuroraPG
    N3 --> AuroraPG
    AuroraPG -. Replication .-> ReadReplica
```

### Phase 1: Distributed Socket Routing via Redis Adapter

* **Mechanism**: Deploy `@socket.io/redis-adapter` or `@socket.io/redis-streams-adapter`.
* **Impact**: Sockets on Node 1 can broadcast to rooms where members are connected to Node 2 or Node 3. Inter-socket communication is completely transparent.

### Phase 2: Centralized Matchmaking Queue

* **Mechanism**: Move `waitingQueue` into Redis Sorted Sets (`ZSET`) keyed by rating, with atomic leasing via Redis Lua scripts or Redlock.
* **Impact**: Matchmaking becomes distributed and cluster-wide. Any server can pop two matching players from the queue and assign them to an active match room.

### Phase 3: Dedicated Game Engine Worker Routing

* **Mechanism**: Assign matches to dedicated engine processes using consistent hashing on `matchId` or dynamic match coordinator scheduling.
* **Impact**: Decouples lightweight socket proxying from CPU-bound game engine action loops, enabling autoscaling based on active match count.

### Phase 4: Event Streaming & Asynchronous Telemetry

* **Mechanism**: Stream operational events, security alerts, and match history to Apache Kafka or Redpanda.
* **Impact**: Match finalization, ELO recalculation, and audit logging happen asynchronously without blocking the real-time event loop.
