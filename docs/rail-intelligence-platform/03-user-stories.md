# 3. User Stories

Format: `As a <persona>, I want <capability>, so that <benefit>.` Each story includes acceptance criteria (AC) and maps to features in [§4](04-feature-breakdown.md).

## 3.1 Casual Passenger (Priya)

**US-1: Search for a train**
- As a casual passenger, I want to search by train number or name (with autocomplete/fuzzy match), so that I can find my train even if I don't remember the exact number.
- AC: Typing "1230" or "Rajdhani" returns matching trains within 300ms; supports Hindi transliteration (e.g., "rajdhani"/"राजधानी").

**US-2: See live status at a glance**
- As a casual passenger, I want to instantly see if my train is on time, delayed, or early, with a single clear color/icon, so that I can decide when to leave for the station.
- AC: Status badge shows "On Time / Delayed Xm / Early Xm" with green/amber/red + icon (not color alone); last-updated timestamp visible.

**US-3: View live map**
- As a casual passenger, I want to see my train moving on a map with the next station and ETA, so that I understand how far away it is.
- AC: Map centers on train marker; shows last 3 and next 3 stations; ETA to next station updates every refresh cycle.

**US-4: Share live status**
- As a casual passenger, I want to share a link/snapshot of my train's live status with family, so that they know when to pick me up.
- AC: "Share" button generates a public read-only link + WhatsApp/SMS share sheet.

## 3.2 Daily Commuter (Arjun)

**US-5: Save favorite trains**
- As a daily commuter, I want to save my regular train(s) to a favorites list, so that I can check them with one tap.
- AC: Favorites persist across sessions (account or local storage); home screen shows favorites with live status.

**US-6: Set delay alerts**
- As a daily commuter, I want to be notified if my train is running more than X minutes late, so that I can adjust my plans.
- AC: User sets threshold (5/10/15/30 min); push notification fires within 1 minute of threshold breach; configurable per train.

**US-7: View reliability score & trends**
- As a daily commuter, I want to see how reliable my train has been over the last 30 days, so that I can decide whether to rely on it for important commitments.
- AC: Reliability score (0-100) displayed with explanation tooltip; 7-day and 30-day delay trend charts.

## 3.3 Receiving Family (Lakshmi)

**US-8: Track without app install**
- As a family member without the app, I want to open a shared link and see live tracking in a browser, so that I don't need to install anything.
- AC: Shared link renders full live-tracking view as a public web page (no login required), mobile-optimized.

**US-9: Get arrival notification**
- As a family member, I want an SMS/notification when the train is approaching the destination station (e.g., 30 min out), so that I can time my arrival at the station.
- AC: Opt-in via phone number (OTP-verified); notification sent when ETA to destination ≤ configurable threshold.

## 3.4 Railway Analyst / Journalist (Dev)

**US-10: Replay historical journey (Time Machine)**
- As an analyst, I want to select any train and any past date and watch its journey replay on the map with timing data overlaid, so that I can investigate specific incidents (e.g., "why was train X 4 hours late on date Y").
- AC: Calendar date-picker restricted to dates with available data; playback controls (play/pause/speed/scrub); station-by-station actual vs scheduled times shown synced to playback position.

**US-11: Export historical data**
- As an analyst, I want to export station-wise schedule/actual/delay data for a train over a date range as CSV/JSON, so that I can do my own analysis.
- AC: Export available for date ranges up to 1 year (paid tier); rate-limited; includes metadata (data source, confidence).

**US-12: Compare trains/routes**
- As an analyst, I want to compare reliability scores and delay trends across multiple trains on the same route, so that I can identify systemic vs train-specific issues.
- AC: Multi-select up to 5 trains; side-by-side chart comparison.

## 3.5 Railway Operations Staff (Officer Singh)

**US-13: Division/zone dashboard**
- As an operations analyst, I want an aggregated view of all trains in a division/zone with anomaly flags, so that I can spot systemic delays in real time.
- AC: Dashboard groups trains by zone/division; flags trains delayed >X min or with anomalous stoppage (e.g., stopped >15 min between stations with no scheduled halt).

**US-14: AI-generated operational insights**
- As an operations analyst, I want plain-language AI-generated summaries (e.g., "Train 12002 has recovered 18 minutes in the last 4 stations and is expected to reach New Delhi only 7 minutes late"), so that I can quickly grasp the situation without reading raw tables.
- AC: Insight text regenerates as new data arrives; insights are explainable (link to underlying data points).

## 3.6 Developer / API Consumer

**US-15: Self-serve API access**
- As a developer, I want to register for an API key and read documentation with example requests/responses, so that I can integrate train data into my application.
- AC: Self-serve signup; API key issued instantly for free tier (rate-limited); OpenAPI docs with "try it" console.

**US-16: Webhook subscriptions**
- As a developer, I want to subscribe to webhooks for specific train/station events (arrival, departure, delay change), so that I don't need to poll.
- AC: Webhook config UI; signed payloads (HMAC); retry with exponential backoff.

## 3.7 Cross-Cutting

**US-17: Multi-language UI**
- As any user, I want the interface in Hindi or English, so that I can use the app comfortably.
- AC: Language toggle persists; station/train names shown in both English and local script where available.

**US-18: Offline/poor-connectivity tolerance**
- As any user on a slow network, I want the app to show cached data with a "stale" indicator rather than failing, so that I still get useful information.
- AC: Service worker caches last-known state; UI shows "Showing data from X minutes ago — reconnecting..." banner.
