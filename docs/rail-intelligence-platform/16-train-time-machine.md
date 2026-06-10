# 16. Train Time Machine — Deep Dive

> *"Select any train and any historical date, then watch the train move along the route as a playback animation — like aircraft replay in flight-tracking systems."*

This is the platform's **signature, differentiating feature** (no incumbent app offers it — see [§1.4](01-executive-summary.md#14-competitive-landscape)) and the recommended **growth/virality engine** ([§1.5](01-executive-summary.md#15-contrarian--challenge-the-brief-recommendations)). A static prototype of the player UI is in [`/prototype/index.html`](../../prototype/index.html).

## 16.1 User Flow

1. User searches/selects a train (e.g., 12951 Mumbai Rajdhani).
2. Taps **"History / Time Machine"** tab.
3. A calendar date-picker appears, **with available dates highlighted** (only dates where `train_runs` has a completed/partial record) — unavailable dates are disabled/greyed.
4. On date selection, the app calls `GET /trains/{n}/runs/{date}/replay` (see [§6.2](06-api-design.md#core-endpoints)).
5. The map loads the full route polyline; a train marker appears at the origin station.
6. Playback controls appear: Play/Pause, Scrub bar, Speed (1x/2x/4x/8x), and Skip-to-station buttons.
7. As playback progresses, the marker animates along the route (interpolated between recorded positions), passed stations fill in, and the right-side panel updates the station timeline + delay readout to match the playhead time.
8. At the end (or at any point), the user can **export a short clip/GIF** of the replay to share.

## 16.2 Data Requirements

| Data | Source | Notes |
|---|---|---|
| Route geometry (polyline) | `route_geometries` table | Static per train, precomputed from OSM |
| Recorded positions for that run | `position_logs WHERE run_id = ?` | May be sparse for low-traffic trains/older dates |
| Station events (actual times) | `station_events WHERE run_id = ?` | Always present if the run was tracked at all |
| Delay-at-time-T | Derived: interpolate delay between consecutive `station_events` | Used to color-code the path/marker during playback |

### Handling sparse GPS data (the realistic case for V1)

Many runs — especially before the crowd-GPS moat matures — will have **station-level data only** (arrival/departure times) with **no or few intermediate GPS pings**. The replay must still work:

- **Interpolation strategy:** between station A (actual departure time `tA_dep`, distance `dA`) and station B (actual arrival time `tB_arr`, distance `dB`), interpolate position **linearly along the route geometry** by elapsed-time fraction: `fraction = (t - tA_dep) / (tB_arr - tA_dep)`, `distance = dA + fraction * (dB - dA)`, then `ST_LineInterpolatePoint(route_geom, distance/total_distance)`.
- When real `position_logs` exist for a segment, prefer them (smoother, more accurate); fall back to interpolation for gaps.
- The UI **visually distinguishes** interpolated vs recorded segments (e.g., dashed vs solid path) — maintains trust/transparency, consistent with the `data_quality` field on `train_runs`.

## 16.3 Playback Engine (Frontend)

- **Map layer:** Leaflet with a custom animated marker; for smoother large-scale animation (esp. if later showing multiple trains), `deck.gl`'s `TripsLayer` is purpose-built for this (it's literally designed for "trip replay" visualizations and used by transit-replay demos).
- **Timing model:** the player operates on a virtual clock `playheadTime` ranging from `run.actual_start_time` to `run.actual_end_time`. A "speed" multiplier (1x/2x/4x/8x) advances `playheadTime` faster than wall-clock time. At "1x", a typical 17-hour journey would take far too long to watch — so **"1x" should map to a fixed wall-clock duration** (e.g., the full journey plays in ~90 seconds at "1x"), with 2x/4x/8x compressing further. Label this clearly in the UI as "Playback Speed", distinct from real-time ratio.
- **Position lookup:** binary search over the (sorted) position/interpolation timeline for the two bracketing points around `playheadTime`, then linear-interpolate lat/lon between them for smooth sub-sample movement (avoids "jumping" between sparse points).
- **Synced UI:** station timeline, delay readout, and "current segment" highlight all derive from the same `playheadTime` — single source of truth avoids desync bugs.
- **Scrubbing:** dragging the timeline scrub bar updates `playheadTime` directly (pause auto-advance while dragging).

## 16.4 API Contract (recap)

`GET /trains/{trainNumber}/runs/{date}/replay?resolution_seconds=60`

Returns (see full schema in [`/api/openapi.yaml`](../../api/openapi.yaml) `ReplayPayload`):
- `route_geometry` (GeoJSON LineString)
- `positions[]` — downsampled time-position array (server-side downsampling via `resolution_seconds` to keep payload small for long journeys; e.g., a 17-hour journey at 60s resolution ≈ 1,020 points, trivial payload size)
- `station_events[]` — actual vs scheduled per station
- `summary` — total duration, avg speed, final/max delay

## 16.5 "Export Clip" Feature

- **Client-side rendering** (recommended for V1): use `html2canvas`/`canvas` capture of the map + overlay at intervals, assembled into a GIF/WebM via a library like `gif.js` (runs in a Web Worker to avoid blocking UI). Avoids server-side rendering infrastructure entirely for V1.
- **Server-side rendering** (V2, if higher quality/branding needed): a headless-browser render service (Playwright) that renders the same replay UI and captures frames server-side, producing branded MP4/GIF for sharing — justified once volume/quality demands exceed client-side capability.
- Exported clips include a small branded watermark/link — this is the organic growth loop.

## 16.6 Edge Cases

| Case | Handling |
|---|---|
| Train cancelled that day | Show "Train was cancelled on {date}" with whatever partial data exists; no replay animation, or replay only the completed portion |
| Train terminated early / short-terminated | Replay plays up to the last recorded station; route shown greyed-out beyond that point |
| No data at all for selected date | Date should be disabled in the picker (server provides available-dates list via `/trains/{n}/runs?from=&to=`) |
| Multi-day journey (e.g., crosses midnight, 30+ hour trains) | `run_date` = origin departure date; replay timeline spans the full multi-day duration, date label shows day offsets ("Day 1", "Day 2") |
| Very long journeys (e.g., Vivek Express, 4,000+ km, ~80 hours) | Default playback speed scales so total replay stays within a reasonable wall-clock viewing time (e.g., cap at ~3 minutes at default speed regardless of journey length) |

## 16.7 Future Extensions (V2+)

- **Multi-train replay:** show all trains on a route/zone simultaneously for a given historical date — useful for ops/analyst "what happened on this route during the cyclone/strike on date X" investigations.
- **Comparison mode:** replay the same train on two different dates side-by-side (e.g., "normal day" vs "fog-delayed day").
- **Annotations:** allow ops users to attach notes/incident tags to specific points in a replay (feeds anomaly dataset and journalist/analyst research use cases).
