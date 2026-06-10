# 4. Feature Breakdown

Priority key: **P0** = MVP (must ship), **P1** = V1 (within 3 months of MVP), **P2** = V2/Advanced (6-12 months+)

## 4.1 Real-Time Train Tracking

| Sub-feature | Priority | Notes / Dependencies |
|---|---|---|
| Train search (number/name, autocomplete, fuzzy + Hindi) | P0 | Requires `trains` reference table (data.gov.in) |
| Live status header (name, number, source/dest, status) | P0 | Requires ingestion of live running data (Track A) |
| Last reported GPS location + timestamp + staleness indicator | P0 | Crowd-sourced GPS (Track B) ideally; NTES position fallback |
| Current/last station + next station | P0 | Map-matched against `route_stations` |
| Distance covered / remaining | P0 | Computed from GPS + route geometry (PostGIS `ST_LineLocatePoint`) |
| Current speed & direction of movement | P1 | Derived from consecutive GPS pings (needs ≥2 pings, smoothing) |
| Live map with moving marker | P0 | Leaflet + OSM tiles |
| Route visualization (full polyline) | P0 | Precomputed route geometries in PostGIS |
| Auto-refresh (polling/WebSocket) | P0 | WebSocket preferred for active sessions; 15-30s interval |

## 4.2 Schedule vs Actual Performance

| Sub-feature | Priority | Notes |
|---|---|---|
| Station-by-station table (Sched Arr/Dep, Actual Arr/Dep, Delay) | P0 | Core table — see DB schema `station_events` |
| Color coding (Green/Yellow/Red, + icons for accessibility) | P0 | Thresholds configurable: Early >1min early, On-time ±5min, Delayed >5min |
| Current delay (live) | P0 | Latest `station_events` delta |
| Max delay today | P0 | Aggregation over today's `station_events` for this run |
| Average delay (this run, all stations so far) | P0 | Aggregation |
| Recovery of lost time (delta between max delay and current delay) | P1 | Derived metric, feeds AI insights |
| "Minutes running ahead of schedule" indicator | P1 | For early-running trains |

## 4.3 Historical Train Intelligence

| Sub-feature | Priority | Notes |
|---|---|---|
| Date picker (calendar, restricted to available data range) | P0 | `train_runs` table indexed by date |
| Complete route map for selected day | P0 | Reconstructed from `position_logs` for that `train_run_id` |
| Actual journey path (polyline of recorded GPS) | P1 | Requires sufficient GPS density; fallback to interpolation between stations |
| Historical station timings table | P0 | `station_events` for that run |
| Delay at each station (table + chart) | P0 | |
| Total journey duration & average speed | P1 | Derived |
| Delay heatmap (stations × time-of-day or × date) | P2 | Aggregation across many runs |
| Route timeline (Gantt-style) | P1 | |
| **Historical replay mode ("Time Machine")** | P0 | See dedicated doc [§16](16-train-time-machine.md) |

## 4.4 Delay Analytics Engine

| Sub-feature | Priority | Notes |
|---|---|---|
| Avg delay last 7 / 30 days | P0 | Materialized view, refreshed hourly |
| Most delayed stations (per train) | P0 | Aggregation over `station_events` |
| Stations where train recovers time | P1 | Negative delta in delay between consecutive stations |
| Delay trends by season | P2 | Requires ≥1 year of data |
| Day-of-week performance | P1 | Group by `EXTRACT(DOW FROM run_date)` |
| **Reliability Score (0-100)** | P0 | Weighted formula — see [§4.4.1](#441-reliability-score-formula-v1) |

### 4.4.1 Reliability Score Formula (v1)

A transparent, explainable formula (avoids "black box ML score" distrust):

```
ReliabilityScore = 100
  - min(40, avg_delay_30d_minutes * 1.2)        # punctuality component (max -40)
  - min(30, stddev_delay_30d_minutes * 1.5)     # consistency component (max -30)
  - min(20, cancellation_rate_30d * 100 * 2)    # cancellations (max -20)
  - min(10, severe_delay_rate_30d * 100)        # % of runs delayed >60min (max -10)
```
Clamped to [0, 100]. Each component shown in a breakdown tooltip ("why this score").

## 4.5 Route Visualization (GIS)

| Sub-feature | Priority | Notes |
|---|---|---|
| Source/destination + intermediate station markers | P0 | |
| Railway track overlay | P1 | OSM `railway=rail` ways, simplified per route |
| Train movement animation (live) | P0 | Smooth interpolation between GPS pings |
| Historical route playback | P0 | Time Machine |
| Delay markers on map (color-coded per station) | P1 | |
| Speed markers along route | P2 | Color-coded polyline segments by speed |

## 4.6 Predictive Arrival Engine

| Sub-feature | Priority | Notes |
|---|---|---|
| ETA for next station (rule-based) | P0 | "Current delay carries forward" baseline |
| ETA for next station (ML) | P1 | Gradient-boosted model — see [§15](15-ai-features.md) |
| ETA for destination (ML) | P1 | |
| Probability of further delay | P2 | Classification model |
| Confidence score | P1 | Based on prediction interval width / historical accuracy for this train |
| Expected final arrival deviation | P1 | |

## 4.7 Train Performance Dashboard

| Sub-feature | Priority | Notes |
|---|---|---|
| KPI cards: current delay, avg delay, avg speed, punctuality %, reliability score | P0 | |
| Last 30 trips performance (table/chart) | P0 | |
| Best/worst performing month | P1 | Requires ≥2 months of data |
| Charts: delay trend line, station delay bar chart, day-of-week heatmap | P0/P1 | Recharts/Chart.js |

## 4.8 AI / Intelligence Features (see [§15](15-ai-features.md))

| Sub-feature | Priority |
|---|---|
| Delay prediction model | P1 |
| Congestion forecasting | P2 |
| Route anomaly detection | P1 |
| AI-generated operational insights (NLG) | P1 |

## 4.9 Platform / Cross-Cutting

| Sub-feature | Priority | Notes |
|---|---|---|
| User accounts (favorites, alerts) | P0 | Email/phone OTP auth |
| Push/SMS/email notifications | P1 | |
| Multi-language (EN/HI) | P0 | |
| PWA (installable, offline cache) | P0 | |
| Public shareable links | P0 | |
| Developer API + docs | P1 | |
| Admin/ops dashboard (data quality monitoring) | P1 | Internal tool |
