# 9. Tech Stack Recommendation

## 9.1 Frontend (Web)

| Choice | Rationale | Alternatives considered |
|---|---|---|
| **Next.js 14+ (App Router) + React 18 + TypeScript** | SSR for fast first paint (critical on 4G), file-based routing, built-in image/CDN optimization, easy PWA setup | Remix (good, smaller ecosystem); plain CRA/Vite SPA (worse SEO/initial load for public share links) |
| **Tailwind CSS** | Rapid, consistent design-system implementation; small final CSS bundle | CSS Modules, styled-components (more runtime cost) |
| **Leaflet + react-leaflet** (OSM tiles, optionally CARTO dark tiles) | Free, no API key required, large community, sufficient for marker animation + polylines | Mapbox GL JS (better for advanced 3D/vector styling but paid at scale); Google Maps (most expensive, ToS restrictions on data display) |
| **deck.gl** (optional, for Time Machine route playback at scale) | GPU-accelerated trip animation layer (`TripsLayer`) — purpose-built for "flight radar" style replays | Pure Leaflet animation (fine for single-train replay; deck.gl better if showing many trains at once) |
| **Recharts** | Simple, composable charts for delay trends, reliability breakdowns | Chart.js, Visx (more flexible but more code) |
| **TanStack Query (React Query)** | Data fetching/caching/polling for live endpoints | SWR (similar; React Query has better devtools) |
| **Zustand** | Lightweight global state (favorites, selected train, replay state) | Redux Toolkit (more boilerplate than needed) |

## 9.2 Mobile (Phase 2)

| Choice | Rationale |
|---|---|
| **React Native (Expo)** | Shares types/business logic with web (TypeScript), large ecosystem, Expo simplifies push notifications & background location | 
| **react-native-maps** | Native map performance for live tracking | 
| Background location (Expo Location, `expo-task-manager`) | Required for the crowd-sourced GPS data moat — this is the **primary justification for going native** beyond PWA |

> Flutter is a credible alternative (excellent performance, single codebase) but **React Native is recommended** to maximize code/type sharing with the Next.js/TypeScript web codebase and team hiring pool in India.

## 9.3 Backend

| Choice | Rationale | Alternatives |
|---|---|---|
| **Node.js (NestJS) — Tracking, Schedule, Notification services** | Best-in-class WebSocket support, TypeScript shared with frontend, structured DI architecture | Go (excellent perf, but splits team skill sets) |
| **Python (FastAPI) — Analytics, Prediction, AI Insight services** | Native ecosystem for pandas/scikit-learn/XGBoost/PyTorch, async support, auto OpenAPI docs | Django (heavier, less suited to microservice APIs) |
| **gRPC or REST internally** between services | REST/JSON for simplicity at this scale; revisit gRPC if internal call volume becomes a bottleneck | |

## 9.4 Database & Storage

| Choice | Rationale |
|---|---|
| **PostgreSQL 16 + PostGIS** | Mature geospatial support, ACID for reference/schedule data, single source of truth |
| **TimescaleDB extension** | Hypertables for `position_logs` (GPS time series) — continuous aggregates, retention/compression policies, while staying in the Postgres ecosystem (no separate InfluxDB cluster needed) |
| **Redis** | Live-state cache (`live:{train_number}`), pub/sub for WebSocket fan-out, rate-limiting token buckets, job queues (BullMQ) |
| **S3-compatible object storage** | Route geometry GeoJSON, exported CSVs, replay GIF/clip renders, ML model artifacts |

## 9.5 ML / AI

| Choice | Rationale |
|---|---|
| **scikit-learn / XGBoost / LightGBM** for delay & ETA prediction | Tabular data, fast training/inference, explainable (SHAP), no GPU needed |
| **Prophet or simple seasonal decomposition** for congestion/seasonal trend forecasting | Quick to implement, interpretable |
| **Isolation Forest / statistical thresholds** for anomaly detection | Lightweight, works with limited labeled data |
| **LLM (Claude API) for AI-generated insights (NLG)** — template + LLM hybrid | Use deterministic templates for the 80% common cases (cheap, instant, no hallucination risk); call an LLM only for synthesizing multi-factor narrative summaries, with strict grounding in structured data passed in the prompt |
| **Airflow** for scheduled retraining/aggregation pipelines | Standard, good Postgres/S3 integrations |

## 9.6 Infrastructure / DevOps

| Choice | Rationale |
|---|---|
| **Docker** for all services | Consistency across dev/staging/prod |
| **Kubernetes (EKS/GKE/AKS)** — recommend **AWS EKS in `ap-south-1` (Mumbai)** | Lowest latency to Indian users & to NTES scraping targets; managed RDS Postgres w/ PostGIS+Timescale support, ElastiCache Redis, MSK/Kafka |
| **Terraform** for IaC | Reproducible environments |
| **GitHub Actions** for CI/CD | Already used widely, integrates with container registry & EKS deploys |
| **Cloudflare** (CDN + DDoS protection + Workers for edge caching of `/live` responses) | Cheap, effective for a India-heavy traffic pattern with spiky load (festival travel seasons) |
| **Observability:** Prometheus + Grafana (metrics), Loki (logs), Sentry (errors), OpenTelemetry tracing | Standard OSS observability stack |

## 9.7 Why Not [Common Alternatives]

- **Firebase/Supabase as primary backend:** rejected — PostGIS + TimescaleDB geospatial/time-series needs and the custom ingestion pipeline are too specialized for a BaaS; Supabase (which is Postgres-based) could be considered for the *auth* layer only to reduce build time, but core data plane needs full Postgres control.
- **Mapbox as default map provider:** rejected for V1 due to per-load pricing risk at consumer scale (millions of map loads/month); revisit once revenue justifies the better styling/vector tiles, possibly self-hosted via OpenMapTiles.
- **MongoDB for position logs:** rejected — TimescaleDB gives SQL + geospatial joins against reference data (stations/routes) in one query, which a document store would require denormalizing or joining client-side.
