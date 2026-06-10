# 2. Product Requirements Document (PRD)

## 2.1 Product Name

**Indian Rail Live Intelligence Platform** (working name; consumer brand suggestion: **"RailPulse"**)

## 2.2 Problem Statement

Passengers, families waiting at stations, and railway analysts have no single tool that combines **live position**, **schedule-vs-actual performance**, **historical journey replay**, and **predictive ETAs** with a modern, trustworthy UX. Existing tools are either official-but-clunky (NTES) or consumer-but-shallow (live position only, no analytics, no history).

## 2.3 Goals & Non-Goals

### Goals (V1)
- G1: Given a train number, show live position, status, and ETA within 3 seconds, with map visualization.
- G2: Show full station-by-station schedule vs actual performance with color-coded delay status.
- G3: Allow replay of any train's journey for any date in the last 12 months ("Time Machine").
- G4: Provide a Reliability Score (0–100) and delay analytics (7/30-day trends, most-delayed stations).
- G5: Provide ML-based predictive ETA with confidence score for next station and destination.
- G6: Premium, FlightRadar24/Uber-quality UX, mobile-responsive web (PWA).

### Non-Goals (V1)
- NG1: Ticket booking / IRCTC integration (out of scope — legal/commercial complexity, redirect to IRCTC).
- NG2: Freight train tracking (different data model, defer to V2).
- NG3: Native mobile apps (PWA first; native in Phase 2 per [§1.5](01-executive-summary.md#15-contrarian--challenge-the-brief-recommendations)).
- NG4: Real-time seat availability / PNR status (adjacent product, not core to "intelligence platform").

## 2.4 Target Users / Personas

| Persona | Description | Primary Need |
|---|---|---|
| **Casual Passenger (Priya)** | Booked a ticket, wants to know if her train is on time before leaving for the station | Fast, simple "where is my train + is it late" |
| **Daily Commuter (Arjun)** | Takes the same train daily, cares about his commute's reliability over time | Reliability score, delay trends, push alerts |
| **Receiving Family (Lakshmi)** | Waiting at destination station for a relative | Live ETA, simple shareable link |
| **Railway Analyst / Journalist (Dev)** | Researches punctuality for reports/articles | Historical data, exports, replay, zone comparisons |
| **Railway Operations Staff (Officer Singh)** | Wants operational insight at division level | Aggregated dashboards, anomaly alerts |
| **Developer / Partner (API consumer)** | Builds travel apps, needs train data | Documented REST/WebSocket API, SLAs |

## 2.5 Success Metrics (North Star + Supporting)

- **North Star:** Weekly Active Trains Tracked (unique train numbers searched/tracked by ≥1 user per week)
- Supporting metrics:
  - DAU/MAU, session duration, retention (D1/D7/D30)
  - % of sessions using Time Machine (target ≥15% by month 6)
  - Prediction accuracy: median absolute ETA error ≤ 8 minutes for next station
  - Reliability Score correlation with actual punctuality (validated quarterly)
  - API partner count and call volume (B2B)
  - Crowd-sourced GPS pings/day (data moat health metric)

## 2.6 Key User Flows (Summary)

1. **Search → Live Track**: User opens app → enters train number/name → sees live dashboard (map, ETA, schedule table) within 3s.
2. **Time Machine**: User opens train → taps "History" → picks date from calendar → replay controls appear → plays animation of that day's journey with delay overlay.
3. **Analytics Dive**: User taps "Performance" tab → sees reliability score, 7/30-day delay trend charts, most-delayed stations, AI insight summary.
4. **Alerts Subscription**: User taps "Notify Me" → sets threshold (e.g., "alert if delay > 15 min") → receives push/SMS/email.
5. **Developer Onboarding**: Visits `/developers` → registers → gets API key → reads OpenAPI docs → makes first call.

## 2.7 Constraints & Assumptions

- **Assumption:** Real-time GPS feed quality will start "best-effort" via Track A/B sources (see [§1.3](01-executive-summary.md#13-the-1-risk-data-access-read-this-first)) — UI must gracefully communicate data freshness/staleness ("Last updated 4 min ago").
- **Constraint:** Must work on low-end Android devices and 3G/4G networks common in Tier-2/3 India — performance budget: <3s First Contentful Paint on 4G.
- **Constraint:** Multi-language support (Hindi + English at minimum for V1; regional languages V2) — railways serve a linguistically diverse population.
- **Constraint:** Accessibility — WCAG 2.1 AA (color-blind-safe delay indicators — not color alone, also icons/text).
- **Assumption:** Initial geographic/data scope = top 500 trains across major routes (Rajdhani, Shatabdi, Vande Bharat, Duronto, major Mail/Express).

## 2.8 Out-of-Scope Risks Acknowledged

- We explicitly will NOT claim to be "official" Indian Railways data — disclaimers required throughout (similar to NTES disclaimers), to manage liability given Track A data fragility.
