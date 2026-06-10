# 7. System Architecture

## 7.1 High-Level Architecture

```mermaid
graph TB
    subgraph Clients
        WEB["Web App / PWA<br/>(Next.js + React + TS)"]
        MOBILE["Mobile App<br/>(React Native, Phase 2)"]
        DEV["3rd-party Developers"]
    end

    subgraph Edge
        CDN["CDN / Edge Cache<br/>(CloudFront / Cloudflare)<br/>map tiles, static assets"]
        GW["API Gateway<br/>(rate limiting, auth, routing)"]
    end

    subgraph Services["Backend Services (Kubernetes)"]
        TRACK["Tracking Service<br/>(Node.js)<br/>live status, WebSocket fan-out"]
        SCHED["Schedule Service<br/>(Node.js)<br/>routes, station tables"]
        ANALYTICS["Analytics Service<br/>(FastAPI / Python)<br/>delay stats, reliability score"]
        PREDICT["Prediction Service<br/>(FastAPI / Python)<br/>ML ETA, anomaly detection"]
        INSIGHT["AI Insight Service<br/>(FastAPI / Python)<br/>NLG summaries"]
        NOTIFY["Notification Service<br/>(Node.js)<br/>push/SMS/email/webhooks"]
        INGEST["Ingestion Service<br/>(Python)<br/>abstraction over data sources"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL + PostGIS<br/>+ TimescaleDB")]
        REDIS[("Redis<br/>live cache, pub/sub, rate limits")]
        S3[("Object Storage<br/>route geometries, exports, replay clips")]
    end

    subgraph Pipeline["Data Ingestion Pipeline"]
        NTES["NTES Scraper<br/>(Track A)"]
        CROWD["Crowd-sourced GPS<br/>(Track B, from app)"]
        OFFICIAL["CRIS / Official Feed<br/>(Track C, future)"]
        STATIC["Static Reference Data<br/>data.gov.in, OSM"]
        QUEUE["Kafka / Redis Streams<br/>event bus"]
        ETL["ETL Workers<br/>map-matching, delay calc"]
        ML["ML Training Pipeline<br/>(Airflow + Python)"]
    end

    WEB --> CDN
    MOBILE --> CDN
    DEV --> GW
    WEB --> GW
    MOBILE --> GW

    GW --> TRACK
    GW --> SCHED
    GW --> ANALYTICS
    GW --> PREDICT
    GW --> INSIGHT
    GW --> NOTIFY

    TRACK --> REDIS
    TRACK --> PG
    SCHED --> PG
    ANALYTICS --> PG
    PREDICT --> PG
    PREDICT --> REDIS
    INSIGHT --> PG
    NOTIFY --> PG
    NOTIFY --> REDIS

    NTES --> QUEUE
    CROWD --> QUEUE
    OFFICIAL -.future.-> QUEUE
    STATIC --> PG

    QUEUE --> ETL
    ETL --> PG
    ETL --> REDIS
    ETL --> S3

    PG --> ML
    ML --> PREDICT
    ML --> INSIGHT

    INGEST --> NTES
    INGEST --> CROWD
    INGEST --> OFFICIAL
```

## 7.2 Service Responsibilities

| Service | Language/Framework | Responsibilities | Scaling notes |
|---|---|---|---|
| **Tracking Service** | Node.js (NestJS) | `/live`, WebSocket fan-out of position updates, reads hot state from Redis | Horizontally scaled; WebSocket connections sharded via Redis pub/sub |
| **Schedule Service** | Node.js (NestJS) | Static route/timetable data, station search | Heavily cached (CDN + Redis), low write volume |
| **Analytics Service** | Python (FastAPI) | Delay stats, reliability score, comparisons, exports | Reads materialized views; CPU-bound aggregations run as scheduled jobs, served pre-computed |
| **Prediction Service** | Python (FastAPI) | Serves ML model inference for ETA/delay-probability | Model artifacts loaded from S3; horizontal pods behind GW; consider GPU only if deep models needed (likely not — gradient boosting is CPU-fine) |
| **AI Insight Service** | Python (FastAPI) | Generates NLG insight text (template-based + LLM-assisted), caches per run | Rate-limited LLM calls; cache aggressively (insights regenerate only on material state change) |
| **Notification Service** | Node.js | Alert evaluation, push (FCM/APNs), SMS (MSG91/Twilio), email, webhooks | Queue-driven (Bull/Redis) |
| **Ingestion Service** | Python | **The critical abstraction layer** — normalizes NTES scrape, crowd GPS, and (future) official feeds into a common `position_logs`/`station_events` schema | Designed so Track A can be disabled/replaced without downstream changes |

## 7.3 Data Ingestion Pipeline (Detail)

```mermaid
sequenceDiagram
    participant App as Mobile/Web App (on train)
    participant Ingest as Ingestion Service
    participant Queue as Event Bus (Kafka/Redis Streams)
    participant ETL as ETL Worker
    participant DB as PostgreSQL/PostGIS/TimescaleDB
    participant Cache as Redis

    par Crowd GPS
        App->>Ingest: POST /gps-report (lat, lon, t, consent)
        Ingest->>Queue: publish raw_position
    and NTES Scrape (fallback/cross-check)
        Ingest->>Ingest: scheduled scrape (every 60-120s per active train)
        Ingest->>Queue: publish raw_position (source=ntes_scrape)
    end

    Queue->>ETL: consume raw_position
    ETL->>ETL: map-match to route geometry (PostGIS ST_LineLocatePoint)
    ETL->>ETL: outlier rejection (Kalman filter / speed sanity check)
    ETL->>DB: insert position_logs
    ETL->>ETL: detect station arrival/departure crossing
    ETL->>DB: upsert station_events (actual times, computed delay)
    ETL->>Cache: SET live:{train_number} = latest state
    Cache-->>App: WebSocket push via Tracking Service
```

**Key design point:** multiple sources write to the same normalized `position_logs` table with a `source` tag and `accuracy_m`. The ETL layer reconciles conflicting sources (e.g., prefer high-accuracy crowd GPS over NTES's coarse "last station" updates) — this reconciliation logic is isolated so that adding an "official_feed" source (Track C) is additive, not a rewrite.

## 7.4 Deployment Topology

```mermaid
graph LR
    subgraph "Region: ap-south-1 (Mumbai)"
        subgraph "K8s Cluster"
            APIGW[API Gateway / Ingress]
            SVCS[Backend Services Pods]
            WORKERS[ETL/ML Worker Pods]
        end
        RDS[(Managed PostgreSQL<br/>+ PostGIS + TimescaleDB)]
        REDISC[(Managed Redis)]
        KAFKA[(Managed Kafka /<br/>Redis Streams)]
        S3B[(Object Storage)]
    end
    CDN2[Global CDN]
    USERS((Users across India))

    USERS --> CDN2 --> APIGW
    APIGW --> SVCS
    SVCS --> RDS
    SVCS --> REDISC
    WORKERS --> KAFKA
    WORKERS --> RDS
    WORKERS --> S3B
    SVCS --> S3B
```

- Single region (Mumbai, `ap-south-1`) for V1 — lowest latency to Indian users and to Indian data sources; multi-AZ for HA.
- Read replicas of PostgreSQL for analytics-heavy queries, separate from the live-write path.
- TimescaleDB hypertable on a dedicated instance/tablespace if `position_logs` volume grows large.

## 7.5 Why Microservices (and Why Not More)

- Split by **read/write pattern and language fit**: Node.js for I/O-bound real-time (WebSockets), Python/FastAPI for compute-heavy analytics/ML — this is the primary justification, not "microservices for its own sake".
- **Not** splitting further (e.g., separate "favorites service") — at MVP scale, a monolith-per-domain (4-5 services) is the right granularity. Over-fragmentation adds operational cost without benefit at this stage.
- All services share the same PostgreSQL instance initially (separate schemas); split databases only if a specific service becomes a scaling bottleneck.
