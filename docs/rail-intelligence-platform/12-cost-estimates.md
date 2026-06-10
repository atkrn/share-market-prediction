# 12. Cost Estimates

All figures are **rough planning estimates** in USD (with INR equivalents at ~₹83/$ where useful), assuming an India-based team and AWS `ap-south-1`. Treat as order-of-magnitude for budgeting, not quotes.

## 12.1 Team Costs (Phase 0–1, MVP build, ~4 months)

| Role | Count | Notes |
|---|---|---|
| Tech Lead / Architect | 1 | Full-stack + architecture oversight |
| Backend Engineers (Node.js/Python) | 2 | Tracking, schedule, ingestion services |
| ML/Data Engineer | 1 | Ingestion pipeline, ETL, early model work |
| Frontend Engineer (Next.js) | 1-2 | Web PWA |
| Product Designer (UX/UI) | 1 (part-time/contract) | Design system, wireframes → Figma |
| Product Manager | 1 (part-time founder-led ok) | |
| QA / DevOps | 1 (part-time) | CI/CD, testing |

**Estimated MVP team cost (4 months, India market rates):** ~$60,000–$110,000 total (≈ ₹50L–₹90L), depending on seniority mix and whether roles are full-time hires vs contractors.

## 12.2 Infrastructure Costs (Monthly, by stage)

| Component | MVP (500 trains, ~10K MAU) | Growth (2K trains, ~100K MAU) | Scale (13K trains, ~1M+ MAU) |
|---|---|---|---|
| Kubernetes cluster (EKS control + nodes) | $150–300 | $500–1,200 | $3,000–8,000 |
| Managed PostgreSQL (PostGIS+Timescale, RDS/Aurora or self-managed on EC2) | $150–300 | $600–1,500 | $3,000–6,000 |
| Redis (ElastiCache) | $50–100 | $200–500 | $1,000–2,500 |
| Kafka/Redis Streams | $0 (use Redis) | $200–400 | $800–1,500 |
| Object storage (S3) + CDN egress | $20–50 | $200–600 | $1,500–4,000 |
| NTES scraping infra (proxy rotation, if needed) | $50–150 | $300–800 | $1,000–3,000 |
| Monitoring (Prometheus/Grafana/Sentry — mostly OSS, hosted Sentry optional) | $0–50 | $100–200 | $300–600 |
| Push/SMS (FCM free; SMS via MSG91 ~₹0.15-0.20/SMS) | $20–50 | $200–500 | $1,000–3,000 |
| **Total (approx.)** | **$450–1,000/mo** | **$2,100–5,700/mo** | **$11,600–28,600/mo** |

## 12.3 Third-Party Data & API Costs

| Source | Cost |
|---|---|
| data.gov.in (static datasets) | Free |
| OpenStreetMap | Free (self-hosted tiles recommended at scale: $0 license, infra cost only) |
| NTES scraping (Track A) | Free but **high hidden cost**: engineering time to maintain against breakage; consider $200-500/mo for residential proxy rotation if blocked |
| RapidAPI "Indian Railways" wrappers (fallback/cross-check) | $10–100/mo depending on tier (rate-limited; not for primary reliance) |
| LLM API (AI insights, Claude) | Usage-based; with template-first hybrid approach, estimate $50-300/mo at MVP scale, scaling with active-run count |
| CRIS official partnership (Track C, Phase 3) | Unknown — likely a negotiated commercial agreement, potentially $0 (data-sharing/MoU) to significant licensing fee; budget for legal/BD effort, not just cash |
| SMS/Push notification gateway | See infra table above |

## 12.4 One-Time / Periodic Costs

| Item | Estimate |
|---|---|
| Design system & branding (Figma, contractor) | $3,000–8,000 |
| Security audit / penetration test (pre-launch and annually) | $3,000–10,000 |
| App store fees (Apple $99/yr, Google $25 one-time) | ~$125 |
| Legal (ToS, privacy policy, DPDP Act compliance review) | $1,500–5,000 |

## 12.5 Summary by Stage

| Stage | Monthly Burn (Infra) | One-time Build Cost | Notes |
|---|---|---|---|
| Phase 0-1 (MVP) | ~$500-1,000 | ~$60K-110K (team, 4mo) | Bootstrap-friendly; can run on a single small K8s cluster or even managed PaaS initially |
| Phase 2 (V1) | ~$2,000-6,000 | + ~$80K-150K (6mo team incl. mobile dev start) | Crowd-GPS + ML adds data volume costs |
| Phase 3 (V2) | ~$12,000-29,000 | + ~$150K-300K (8-9mo, larger team) | National scale, mobile apps, B2B |

**Contrarian note:** Resist over-provisioning infrastructure ahead of usage. The architecture (managed Postgres, Redis, K8s with autoscaling) scales incrementally — start small (single small RDS instance, 2-3 node cluster) and scale based on real traffic, not projected traffic.
