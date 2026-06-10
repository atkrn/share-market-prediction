# 13. Scalability & Security

## 13.1 Scalability Considerations

### Read-heavy live traffic
- `/live` and `/live/schedule` are by far the highest-traffic endpoints (every active session polls or holds a WebSocket).
- **Pattern:** Tracking Service writes the latest computed state to `Redis` key `live:{train_number}` on every ETL update; all `/live` reads and WebSocket pushes serve from Redis, never hitting Postgres directly. Postgres is the durable record, Redis is the serving layer.
- Cache TTL with background refresh; stale-while-revalidate at the CDN edge for public share-link pages (5-10s cache acceptable).

### WebSocket fan-out
- Use Redis pub/sub (or NATS at larger scale) so any Tracking Service pod can publish a position update once and all subscribed pods relay to their connected clients — avoids N² broadcast.
- Cap concurrent WebSocket connections per pod; horizontal pod autoscaling on connection count + CPU.

### Time-series volume
- 13,000 trains × ~1 GPS ping/30s during ~12hr avg run × 365 days ≈ **~5.7 billion rows/year** at full national scale if every train had dense crowd-GPS — unrealistic for low-traffic trains but plausible for the ~2,000 high-traffic trains.
- TimescaleDB hypertable + compression (30-day) + retention (2-year raw) keeps this manageable; **continuous aggregates** pre-compute hourly/daily rollups for analytics so dashboards never scan raw pings.

### Database scaling
- Start: single Postgres instance (read+write).
- Growth: add **read replicas** for Analytics/Prediction services (these are read-heavy, slightly-stale-tolerant).
- Scale: consider partitioning `station_events`/`train_runs` by year; TimescaleDB hypertable already partitions `position_logs` by time.

### Geographic/CDN strategy
- Static assets, map tiles (self-hosted OSM tiles via OpenMapTiles + tileserver-gl), and public share-link pages served via CDN with edge caching — most of India is geographically far from `ap-south-1` so CDN edge presence matters for latency.

### Graceful degradation under data-source failure
- If NTES scraping is blocked/down: Tracking Service serves last-known state with a prominent "may be outdated" banner; predictions fall back to schedule-only ETAs; this must be a tested failure mode, not an afterthought (per [§1.3](01-executive-summary.md#13-the-1-risk-data-access-read-this-first)).

### Load spikes (festival travel season)
- Indian festival periods (Diwali, Chhath, summer holidays) cause 5-10x traffic spikes on specific high-demand routes. Autoscaling policies should be pre-warmed ahead of known high-demand calendar dates, and Redis/CDN caching absorbs most read load.

## 13.2 Security Requirements

### Authentication & Authorization
- End-user auth: phone OTP (common pattern in India) → short-lived JWT access token + refresh token, stored httpOnly secure cookies for web.
- API partner auth: API key (hashed at rest, `key_hash` in `api_keys` table) + optional OAuth2 client-credentials for enterprise tier.
- Role-based access for internal ops dashboard (admin/analyst roles).

### Data Privacy (DPDP Act 2023 compliance)
- **Crowd-sourced GPS is personal location data** — requires:
  - Explicit, per-trip opt-in consent (not a buried ToS clause).
  - Clear purpose limitation messaging ("used to improve live tracking accuracy for all users").
  - Anonymization: GPS pings stored linked to `run_id` (the train journey), **not** to `user_id` — no requirement to retain user identity with position data beyond what's needed for abuse prevention (short-lived separate audit log).
  - Data retention limits and user-initiated deletion (right to erasure) for account data.
  - Data Protection Officer / grievance contact as required by DPDP Act for significant data fiduciaries (revisit threshold as user base grows).

### API Security
- Rate limiting per API key/IP (Redis token bucket), tiered by plan.
- Input validation on all endpoints (train numbers, dates, station codes) — reject malformed input before hitting DB (parameterized queries throughout; no raw SQL string interpolation, especially given user-supplied search terms).
- HTTPS everywhere (TLS termination at ingress/CDN), HSTS.
- CORS configured per-environment; public share-link pages served read-only with no PII.

### Application Security (OWASP Top 10 alignment)
- SQL injection: parameterized queries / ORM (TypeORM, SQLAlchemy) only.
- XSS: React's default escaping + CSP headers; sanitize any user-generated content (none expected in V1 beyond display names).
- SSRF: ingestion service (which calls external NTES endpoints) runs in an isolated network segment with egress allow-listing.
- Secrets management: AWS Secrets Manager / Kubernetes Secrets + sealed-secrets, never in repo or env files committed to git.
- Dependency scanning (Dependabot/Snyk) in CI.
- Regular penetration testing pre-launch and annually (see cost estimates).

### Abuse Prevention
- Crowd-GPS submission endpoint: server-side sanity checks (speed/position plausibility against route geometry) to reject spoofed/garbage submissions; per-device rate limiting.
- CAPTCHA or device-attestation on auth endpoints to prevent OTP-bombing.

### Monitoring & Incident Response
- Centralized logging (Loki) with PII scrubbing in logs.
- Alerting (Prometheus Alertmanager → PagerDuty/Slack) on data pipeline failures (e.g., NTES scrape success rate drops below threshold) — **data quality is a security/trust issue for this product**, not just an ops metric.
- Incident response runbook for data-source outages, including user-facing status page.

## 13.3 Non-Functional Requirements Summary

| NFR | Target |
|---|---|
| `/live` p95 latency | < 300ms (served from Redis) |
| First Contentful Paint (4G, mid-range Android) | < 3s |
| WebSocket update latency (source → client) | < 5s end-to-end |
| Uptime SLA (public API) | 99.5% (Phase 1), 99.9% (Phase 2+) |
| Data completeness (top trains) | > 90% of scheduled runs have ≥1 position log |
