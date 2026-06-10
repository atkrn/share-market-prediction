# 17. Deployment Strategy

## 17.1 Environments

| Environment | Purpose | Infra |
|---|---|---|
| **Local** | Developer machines | Docker Compose (Postgres+PostGIS+Timescale, Redis, all services) |
| **Staging** | Pre-prod validation, QA, demo | Scaled-down K8s namespace, separate DB, synthetic + sampled real data |
| **Production** | Live | Full K8s cluster, `ap-south-1`, multi-AZ |

## 17.2 CI/CD Pipeline (GitHub Actions)

```mermaid
graph LR
    A[Push / PR] --> B[Lint + Type Check]
    B --> C[Unit Tests]
    C --> D[Build Docker Images]
    D --> E[Integration Tests<br/>(docker-compose, ephemeral DB)]
    E --> F{Branch?}
    F -->|main| G[Push images to registry]
    F -->|PR| H[Deploy to ephemeral PR preview env]
    G --> I[Deploy to Staging]
    I --> J[Smoke Tests]
    J --> K[Manual approval]
    K --> L[Deploy to Production<br/>(rolling update)]
```

- **Database migrations:** versioned (e.g., `node-pg-migrate` / `alembic`), run as a pre-deploy K8s Job; backward-compatible migrations only (additive columns, expand-contract pattern for breaking changes) to support zero-downtime rolling deploys.
- **Frontend:** Next.js build deployed via Vercel **or** self-hosted on K8s behind CDN — recommend starting with Vercel for the web app (fast iteration, built-in CDN/edge) while backend services run on K8s; revisit if cost/control needs change.

## 17.3 Release Strategy

- **Rolling updates** for backend services (K8s default), with readiness/liveness probes.
- **Feature flags** (e.g., via a simple flags table + Redis cache, or a service like Unleash/PostHog) for gradual rollout of risky features (new ML model versions, new data sources) — ties into the Prediction Service's `model_version` shadow-mode evaluation ([§15.7](15-ai-features.md#157-model-governance)).
- **Canary releases** for the Ingestion Service specifically — given its fragility (NTES scraping), new scraper versions roll to a small % of trains first before full rollout.

## 17.4 Observability Stack

| Layer | Tool |
|---|---|
| Metrics | Prometheus + Grafana dashboards (per-service latency/error rate, data pipeline throughput, NTES scrape success rate) |
| Logs | Loki + Grafana, structured JSON logs, PII-scrubbed |
| Tracing | OpenTelemetry → Tempo/Jaeger |
| Errors | Sentry (frontend + backend) |
| Uptime/synthetic checks | Public status page (e.g., status.railpulse.in) with synthetic checks against `/live` for sample trains every 5 min |
| Alerting | Alertmanager → PagerDuty/Slack — critical alerts: data pipeline stalled, scrape success rate <X%, API error rate spike, DB replication lag |

## 17.5 Backup & Disaster Recovery

- Automated daily PostgreSQL snapshots (point-in-time recovery enabled), retained 30 days.
- TimescaleDB continuous aggregates and `train_runs`/`station_events` (the high-value historical record for Time Machine) backed up separately with longer retention than raw `position_logs`.
- Multi-AZ DB deployment for automatic failover; documented runbook for manual failover and restore drills (quarterly).
- RPO target: ≤15 minutes; RTO target: ≤1 hour for full service restoration.

## 17.6 Rollout Plan to Production

1. Phase 0/1: deploy to staging continuously; production deploy gated behind manual approval, weekly cadence initially.
2. Public beta launch: feature-flag gated (invite codes or soft-launch to a subset of regions/trains) to validate data pipeline under real load before full public availability.
3. Post-launch: move to daily/on-demand deploys once test coverage and monitoring confidence are established.

## 17.7 Cost-Conscious Defaults for Early Stage

- Single small K8s cluster (e.g., 3 nodes) with autoscaling enabled but capped, rather than over-provisioning.
- Use managed services (RDS, ElastiCache) over self-managed where the operational savings outweigh the cost premium at this stage — re-evaluate self-hosting only at the "Scale" tier in [§12](12-cost-estimates.md).
