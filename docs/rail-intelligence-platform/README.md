# Indian Rail Live Intelligence Platform

> A FlightRadar24-grade real-time and historical intelligence platform for Indian Railways trains — live tracking, schedule-vs-actual performance, delay analytics, predictive ETAs, and a "Train Time Machine" replay experience.

This directory contains the full design package for the platform. Read in this order:

| # | Document | What it covers |
|---|---|---|
| 1 | [Executive Summary & Strategic Assessment](01-executive-summary.md) | Vision, market context, **critical data-access risk**, contrarian recommendations |
| 2 | [Product Requirements Document](02-prd.md) | Goals, scope, personas, success metrics, constraints |
| 3 | [User Stories](03-user-stories.md) | Persona-based stories with acceptance criteria |
| 4 | [Feature Breakdown](04-feature-breakdown.md) | Every feature decomposed with priority & dependencies |
| 5 | [Database Schema](05-database-schema.md) | ERD + design notes (SQL in [`/database/schema.sql`](../../database/schema.sql)) |
| 6 | [API Design](06-api-design.md) | REST/WebSocket design (spec in [`/api/openapi.yaml`](../../api/openapi.yaml)) |
| 7 | [System Architecture](07-system-architecture.md) | Diagrams, data ingestion pipeline, service boundaries |
| 8 | [UI Wireframes](08-ui-wireframes.md) | Screen-by-screen layout for web & mobile |
| 9 | [Tech Stack](09-tech-stack.md) | Stack choices with rationale & alternatives |
| 10 | [Development Roadmap](10-roadmap.md) | Phase 0 → MVP → V1 → V2 timeline |
| 11 | [MVP vs Advanced Features](11-mvp-vs-advanced.md) | What ships first vs later |
| 12 | [Cost Estimates](12-cost-estimates.md) | Infra, team, and third-party data costs by stage |
| 13 | [Scalability & Security](13-scalability-security.md) | Non-functional requirements |
| 14 | [Data Sources](14-data-sources.md) | Every candidate data source with availability/cost/limits |
| 15 | [AI / ML Features](15-ai-features.md) | Delay prediction, anomaly detection, NLG insights |
| 16 | [Train Time Machine](16-train-time-machine.md) | Deep-dive on the historical replay feature |
| 17 | [Deployment Strategy](17-deployment-strategy.md) | CI/CD, environments, observability |

**Companion artifacts:**
- [`/database/schema.sql`](../../database/schema.sql) — PostgreSQL + PostGIS + TimescaleDB schema
- [`/api/openapi.yaml`](../../api/openapi.yaml) — OpenAPI 3.1 spec for the core API
- [`/prototype/index.html`](../../prototype/index.html) — Static interactive UI prototype (live dashboard + Time Machine), open directly in a browser
