# 8. UI Wireframes

A working interactive mockup of the Live Dashboard + Time Machine is in [`/prototype/index.html`](../../prototype/index.html) — open it in a browser. Below are the full screen-by-screen wireframes for all major views, web and mobile.

## 8.1 Home / Search Screen

```
┌──────────────────────────────────────────────────────────────────┐
│  🚆 RailPulse                                  EN | हिं   👤 Login │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│            Track any Indian train, live and in history           │
│                                                                    │
│   ┌──────────────────────────────────────────────────┐  ┌─────┐  │
│   │ 🔍  Enter train number or name (e.g. 12951)       │  │Track│  │
│   └──────────────────────────────────────────────────┘  └─────┘  │
│                                                                    │
│   Popular: [12951 Mumbai Rajdhani] [12301 Howrah Rajdhani]        │
│            [22439 Vande Bharat]   [12009 Shatabdi]                │
│                                                                    │
│   ⭐ Your Favorites                                                │
│   ┌────────────────────────────┐ ┌────────────────────────────┐  │
│   │ 12951 Mumbai Rajdhani       │ │ 12009 Shatabdi              │  │
│   │ 🟢 On Time · NDLS → BCT     │ │ 🔴 Delayed 22m · BCT → ADI   │  │
│   └────────────────────────────┘ └────────────────────────────┘  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

## 8.2 Live Tracking Dashboard (Web, Desktop)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 🚆 RailPulse   ← Back        12951 · Mumbai Rajdhani         🔔 Notify   ↗ Share   │
├───────────────────────────────────┬───────────────────────────────────────────────┤
│  STATUS BAR                                                                          │
│  🔴 Delayed 14 min  |  Last updated 38s ago (crowd GPS)  | Speed 92 km/h ↗ NE       │
├───────────────────────────────────┬───────────────────────────────────────────────┤
│                                     │  ROUTE & SCHEDULE                              │
│         🗺  LIVE MAP                │  ┌─────────────────────────────────────────┐  │
│   ┌───────────────────────────┐    │  │ Station   Sched Arr  Actual  Delay       │  │
│   │   NDLS●                    │    │  │ NDLS      —          16:55   On time 🟢  │  │
│   │      \                     │    │  │ Mathura   19:05      19:11   +6m 🟡      │  │
│   │       \   ▲ (train marker, │    │  │ Kota      21:33      21:48   +15m 🔴     │  │
│   │        \   pulsing, with   │    │  │ Vadodara  ●current   22:05   +14m 🔴     │  │
│   │   Kota●─●  heading arrow)  │    │  │ Surat     22:48 (ETA 23:02)  pred. +14m  │  │
│   │         \                  │    │  │ BCT       06:25 (ETA 06:39)  pred. +14m  │  │
│   │   Vadodara●                │    │  └─────────────────────────────────────────┘  │
│   │          \                 │    │                                                │
│   │     Surat○ (next, hollow)  │    │  KEY METRICS                                  │
│   │            \                │    │  Current delay: 14m   Max today: 22m         │
│   │            BCT○ (dest)      │    │  Avg delay: 11m       Recovering ✅ -8m/3stn │
│   └───────────────────────────┘    │                                                │
│   [Zoom + / -]  [Recenter]         │  🤖 AI INSIGHT                                 │
│   Distance: 463 km done · 991 left │  "Train 12951 has recovered 8 minutes over     │
│                                     │   the last 3 stations and is expected to       │
│                                     │   reach Mumbai Central only 14 minutes late."  │
└───────────────────────────────────┴───────────────────────────────────────────────┘
│  TABS:  [ Live ]  [ Schedule ]  [ History / Time Machine ]  [ Performance ]         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

Color legend (always paired with icon for accessibility): 🟢 Green = Early/On-time, 🟡 Yellow = minor delay (1-15 min), 🔴 Red = Delayed (>15 min).

## 8.3 Schedule vs Actual Tab (full table)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Station          Plat  Sched Arr  Actual Arr  Sched Dep  Actual Dep   Delay       │
├──────────────────────────────────────────────────────────────────────────────────┤
│  New Delhi (NDLS)   1    —          —          16:55      16:55       On time 🟢   │
│  Mathura Jn (MTJ)   3    19:05      19:11      19:07      19:14       +6m  🟡      │
│  Kota Jn (KOTA)     2    21:33      21:48      21:38      21:55       +15m 🔴      │
│  Vadodara Jn (BRC)  1    01:50      02:04      01:55      02:08 (now) +14m 🔴      │
│  Surat (ST)         2    02:48      ETA 03:02  02:50      —           pred +14m    │
│  Borivali (BVI)     5    06:02      —          06:04      —           pred +13m    │
│  Mumbai Ctl (BCT)   —    06:25      —          —           —          pred +14m    │
└──────────────────────────────────────────────────────────────────────────────────┘
  Summary bar: Current delay 14m | Max delay today 22m (at Kota) | Avg delay 11m |
               Recovery: -8 min over last 3 stations | Running 0 min ahead anywhere
```

## 8.4 Time Machine (Historical Replay)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 🚆 RailPulse    12951 · Mumbai Rajdhani — TIME MACHINE          📅 12 Mar 2026 ▾   │
├───────────────────────────────────┬───────────────────────────────────────────────┤
│                                     │  JOURNEY SUMMARY (12 Mar 2026)                │
│        🗺  REPLAY MAP               │  Total duration: 17h 42m (sched 17h 28m)      │
│   ┌───────────────────────────┐    │  Avg speed: 78.2 km/h                          │
│   │ Full route polyline shown  │    │  Final delay: +14m at BCT                     │
│   │ Train marker ▲ animates    │    │  Max delay: +35m (between MTJ–KOTA)           │
│   │ along the path as playback │    │                                                │
│   │ progresses. Passed stations │    │  STATION TIMELINE (synced to playhead)        │
│   │ shown filled ●, upcoming    │    │  NDLS ●───MTJ ●───KOTA ●───BRC ▲───ST ○───BCT○│
│   │ hollow ○. Delay color-coded │    │         +6m     +35m    +14m                  │
│   │ along the path.              │    │                                              │
│   └───────────────────────────┘    │  At playhead (02:08, BRC):                     │
│                                     │  Sched arr 01:55 · Actual 02:04 · Delay +14m  │
│  ▶  ━━━━━━●────────────────  23%   │  Recovered 21m since KOTA                      │
│  [|◀◀]  [▶ Play]  [▶▶|]   Speed: 1x 2x 4x 8x  |  00:00 ───────────────── 17:42      │
│                                     │  [📷 Export GIF/Clip]  [⬇ Export CSV]          │
└───────────────────────────────────┴───────────────────────────────────────────────┘
```

Interaction notes:
- Scrubbing the timeline updates both the map marker position (interpolated) and the right-side station timeline / delay readout simultaneously.
- Playback speed options: 1x (real ratio compressed, e.g., full journey in ~90s at "1x"), 2x/4x/8x.
- "Export GIF/Clip" renders a shareable short animation — designed as the **viral growth hook** ([§1.5](01-executive-summary.md#15-contrarian--challenge-the-brief-recommendations)).

## 8.5 Performance Dashboard Tab

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  PERFORMANCE — 12951 Mumbai Rajdhani                       Window: [30 days ▾]     │
├───────────────────────────────────┬───────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌────────┐│  DELAY TREND (last 30 days)                    │
│  │Reliability│ │Avg Delay│ │Punctual││   60m ┤                     ●                 │
│  │  Score    │ │ 11.4 min│ │ 87.3% ││   40m ┤        ●     ●  ●  ●   ●              │
│  │   84/100  │ │         │ │       ││   20m ┤   ●  ●    ●        ●      ●  ●  ●     │
│  │  🟢 Good  │ │         │ │       ││    0m ┼──────────────────────────────────     │
│  └─────────┘ └─────────┘ └────────┘│        1   5   10   15  20  25  30 (days ago)  │
│                                     │                                                │
│  RELIABILITY BREAKDOWN              │  MOST DELAYED STATIONS                         │
│  Punctuality   ████████░░  -8       │  1. Kota Jn        avg +18m                   │
│  Consistency   ███████░░░  -7       │  2. Mathura Jn     avg +9m                    │
│  Cancellations ██████████   0       │  3. Ratlam Jn      avg +7m                    │
│  Severe delays █████████░  -1       │                                                │
│                                     │  RECOVERY STATIONS                             │
│  Best month: Jan 2026 (92/100)      │  1. Vadodara Jn    avg -12m recovered          │
│  Worst month: Aug 2025 (68/100)     │  2. Borivali       avg -6m recovered           │
│                                     │                                                │
│                                     │  DAY-OF-WEEK PERFORMANCE (avg delay)           │
│                                     │  Mon ███ Tue ██ Wed ████ Thu ███ Fri █████     │
│                                     │  Sat ██ Sun █                                  │
└───────────────────────────────────┴───────────────────────────────────────────────┘
```

## 8.6 Mobile (PWA) — Live Tracking Screen

```
┌───────────────────────┐
│ ← 12951 Mumbai Rajdhani│
│        🔔   ↗          │
├───────────────────────┤
│ 🔴 Delayed 14 min       │
│ Updated 38s ago         │
├───────────────────────┤
│                         │
│      🗺 MAP             │
│   (full width, train    │
│    marker + route)      │
│                         │
│                         │
├───────────────────────┤
│ Vadodara Jn → Surat     │
│ ETA 23:02 (sched 22:48) │
│ 92 km/h · 991 km left   │
├───────────────────────┤
│ 🤖 Recovered 8 min over │
│ last 3 stations.        │
├───────────────────────┤
│ [Live][Sched][⏱][📊]    │  ← bottom tab bar
└───────────────────────┘
```

## 8.7 Mobile — Time Machine Screen

```
┌───────────────────────┐
│ ← Time Machine          │
│ 12951 · 📅 12 Mar 2026  │
├───────────────────────┤
│                         │
│      🗺 REPLAY MAP       │
│  (animated marker along │
│   route, delay-colored) │
│                         │
├───────────────────────┤
│ ▶ ━━━●──────────  23%  │
│ NDLS→MTJ→KOTA▲→ST→BCT   │
├───────────────────────┤
│ At BRC (02:08)          │
│ Delay +14m (recovered    │
│ 21m since Kota)          │
├───────────────────────┤
│ [1x][2x][4x][8x] [📷Share]│
└───────────────────────┘
```

## 8.8 Design System Notes

- **Typography:** Inter / system font stack; numerals tabular for aligned tables.
- **Color tokens:** `--status-early: #22c55e`, `--status-ontime: #eab308`, `--status-delayed: #ef4444`, `--brand: #0ea5e9`, dark-mode default (matches FlightRadar24/Trainline aesthetic, also better for OLED battery on mobile).
- **Map style:** dark CARTO/OSM basemap with high-contrast route line; train marker = rotated arrow icon indicating heading.
- **Iconography paired with color** throughout for color-blind accessibility (WCAG 2.1 AA).
