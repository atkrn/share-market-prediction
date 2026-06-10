# 6. API Design

Full machine-readable spec: [`/api/openapi.yaml`](../../api/openapi.yaml)

## 6.1 Design Principles

- **REST + JSON** for request/response endpoints; **WebSocket** for live position streaming (lower overhead than polling at scale).
- Versioned: `/api/v1/...`
- All timestamps in **ISO 8601 UTC**; client converts to IST for display.
- Every "live" response includes a `data_freshness` block: `{ "last_updated": "...", "source": "crowd_gps|ntes_scrape|...", "staleness_seconds": 42 }` — critical given Track A/B data realities ([§1.3](01-executive-summary.md#13-the-1-risk-data-access-read-this-first)).
- Pagination via `cursor` query param for list endpoints.
- Rate limiting via `X-RateLimit-*` headers; tiers enforced via Redis token bucket.

## 6.2 Core Endpoints

### Search & Reference Data
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/trains/search?q={query}` | Fuzzy search trains by number/name (EN + Hindi) |
| GET | `/api/v1/trains/{trainNumber}` | Train metadata (name, type, route summary) |
| GET | `/api/v1/trains/{trainNumber}/route` | Full static schedule (all stations, scheduled times) |
| GET | `/api/v1/stations/{stationCode}` | Station metadata |
| GET | `/api/v1/stations/{stationCode}/trains` | Trains passing through a station |

### Live Tracking
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/trains/{trainNumber}/live` | Current live status: position, status, current/next station, distances, speed, ETA |
| GET | `/api/v1/trains/{trainNumber}/live/schedule` | Today's run: station table with sched/actual/delay |
| WS | `/api/v1/ws/trains/{trainNumber}` | Subscribe to live position updates (push every 15-30s while running) |
| POST | `/api/v1/trains/{trainNumber}/gps-report` | **Crowd-sourced GPS ingestion** — authenticated app clients submit `{lat, lon, accuracy, timestamp}` while riding the train (opt-in) |

### Historical / Time Machine
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/trains/{trainNumber}/runs?from={date}&to={date}` | List available historical run dates |
| GET | `/api/v1/trains/{trainNumber}/runs/{date}` | Full run detail: route, station_events, summary stats |
| GET | `/api/v1/trains/{trainNumber}/runs/{date}/positions` | Time-series GPS positions for replay (downsampled) |
| GET | `/api/v1/trains/{trainNumber}/runs/{date}/replay` | Convenience endpoint: combined route + positions + station events optimized for the Time Machine player |

### Analytics
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/trains/{trainNumber}/analytics?window=7d\|30d\|90d\|1y` | Avg delay, most-delayed stations, recovery stations, day-of-week breakdown |
| GET | `/api/v1/trains/{trainNumber}/reliability` | Current reliability score + component breakdown + history |
| GET | `/api/v1/trains/{trainNumber}/insights` | Latest AI-generated natural-language insights |
| GET | `/api/v1/trains/compare?numbers={a,b,c}&window=30d` | Multi-train comparison |

### Predictions
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/trains/{trainNumber}/predictions` | Predicted ETA for next station + destination, confidence, delay probability |

### User / Account
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/otp/request` | Request OTP (phone) |
| POST | `/api/v1/auth/otp/verify` | Verify OTP, returns JWT |
| GET/POST/DELETE | `/api/v1/users/me/favorites` | Manage favorite trains |
| GET/POST/PATCH/DELETE | `/api/v1/users/me/alerts` | Manage delay alerts |
| POST | `/api/v1/share` | Create a public shareable live-tracking link |

### Developer / B2B
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/developers/api-keys` | Issue API key (free tier instant; partner tier requires approval) |
| POST | `/api/v1/webhooks` | Register webhook for train/station events |

## 6.3 Sample Response: `GET /api/v1/trains/12951/live`

```json
{
  "train_number": "12951",
  "name": "Mumbai Rajdhani",
  "run_date": "2026-06-10",
  "status": "running",
  "current_station": { "code": "BRC", "name": "Vadodara Jn" },
  "next_station": {
    "code": "ST", "name": "Surat",
    "scheduled_arrival": "2026-06-10T22:48:00Z",
    "predicted_arrival": "2026-06-10T23:02:00Z"
  },
  "position": {
    "lat": 22.3072, "lon": 73.1812,
    "speed_kmph": 92.4, "heading_degrees": 198.5,
    "distance_covered_km": 463.2, "distance_remaining_km": 990.8
  },
  "delay": {
    "current_minutes": 14,
    "max_today_minutes": 22,
    "average_minutes": 11,
    "trend": "recovering"
  },
  "data_freshness": {
    "last_updated": "2026-06-10T21:55:32Z",
    "source": "crowd_gps",
    "staleness_seconds": 38
  }
}
```

## 6.4 WebSocket Protocol

`wss://api.railpulse.in/v1/ws/trains/{trainNumber}`

- On connect: server sends current full `live` payload.
- Subsequent messages: delta updates `{ "type": "position_update", "data": {...} }`, `{ "type": "station_arrival", "data": {...} }`, `{ "type": "delay_update", "data": {...} }`.
- Heartbeat ping/pong every 30s; client reconnects with exponential backoff.
- Falls back to HTTP polling (`/live` every 20s) if WebSocket unavailable (corporate proxies, etc.).

## 6.5 Error Format (RFC 7807 Problem Details)

```json
{
  "type": "https://railpulse.in/errors/train-not-found",
  "title": "Train not found",
  "status": 404,
  "detail": "No train found with number '99999'.",
  "instance": "/api/v1/trains/99999/live"
}
```

## 6.6 Authentication

- **End users**: phone OTP → JWT (short-lived access + refresh token).
- **API partners**: API key (header `X-API-Key`) for server-to-server; OAuth2 client-credentials for higher tiers.
- **Crowd-GPS ingestion**: requires authenticated app session + explicit per-trip opt-in consent token, to satisfy DPDP Act 2023 requirements (see [§13](13-scalability-security.md)).
