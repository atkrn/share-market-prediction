# 14. Data Sources

> **Read [§1.3](01-executive-summary.md#13-the-1-risk-data-access-read-this-first) first** — this is the most consequential decision area in the entire project. URLs below are reference pointers to well-known portals; **all integrations require independent verification of current ToS, endpoint availability, and authorization before use**, as these change frequently and unofficial endpoints can break or be withdrawn without notice.

## 14.1 Source Comparison Matrix

| Source | What it provides | Availability | Reliability | Cost | Limitations | Reference |
|---|---|---|---|---|---|---|
| **NTES (National Train Enquiry System)** | Live "Spot Your Train" running status, station-wise actual times | Public website, no documented API | Medium — UI changes break scrapers; CAPTCHA/IP-block risk | Free (but high engineering maintenance cost) | Unofficial use only; ToS ambiguous for commercial scraping; rate limits unknown/unpublished | `enquiry.indianrail.gov.in` |
| **data.gov.in (Open Government Data Platform India)** | Static datasets: train list, train schedules, station master list (codes, names, lat/long approximations) | Public, documented downloads/API via OGD platform | High for static data, but **update frequency is slow/irregular** | Free | Not real-time; data can be stale (schedules change without dataset updates); requires cleaning | `data.gov.in` (search "Indian Railways") |
| **CRIS (Centre for Railway Information Systems)** | System of record for NTES, PRS, FOIS — the actual real-time GPS/control data | Not public; commercial/institutional partnerships only | High (if obtained) | Unknown — negotiated | Requires formal partnership/MoU; long lead time | `cris.org.in` |
| **RailMadad** | Passenger grievance data, station amenities feedback | Public-facing portal; data extracts via RTI/data.gov.in possible | Medium | Free | Not a tracking data source — useful for **station-level service quality context**, not live position | `railmadad.indianrailways.gov.in` |
| **OpenStreetMap (OSM)** | Railway track geometry (`railway=rail` ways), station node locations, Overpass API for queries | Public, fully documented | High | Free (self-host tiles for scale) | Track geometry completeness varies by region; some branch lines under-mapped — needs QA | `openstreetmap.org`, Overpass API |
| **RapidAPI third-party "Indian Railways" APIs** | Wrapped NTES/PNR/live status endpoints | Public marketplace, paid tiers | Low-Medium — inherits NTES fragility, multiple competing providers of varying quality | $10-100+/mo | Same legal ambiguity as NTES scraping, one layer removed; useful only as a **cross-check/fallback**, not primary | RapidAPI marketplace |
| **Crowd-sourced GPS (own app users)** | Real-time, high-accuracy position while riding | Built in-house | High accuracy where install base exists | Free (cost = product/engineering to build + incentivize) | Cold-start problem — sparse coverage until install base grows | N/A (proprietary) |
| **IRCTC PNR/seat APIs (if pursued for adjacent features)** | PNR status, seat availability | Official but access-controlled, commercial agreements | High (if obtained) | Licensing fees apply | Out of scope for V1 (NG1 in PRD) | `irctc.co.in` |
| **Historical train running data archives** (community projects, Kaggle datasets, academic research datasets) | Bulk historical schedule/delay data for model bootstrapping | Varies — some public datasets exist from research/community scraping efforts | Variable — verify provenance and licensing before use | Usually free | Licensing/attribution must be checked per dataset; quality varies | Search Kaggle/data.gov.in |

## 14.2 Recommended Sourcing Strategy by Data Type

| Data Need | Primary Source | Fallback | Long-term |
|---|---|---|---|
| Station master list (codes, names, geo) | data.gov.in | OSM node tags | Maintain internal curated table, community-correctable |
| Train list & static schedules | data.gov.in | Manual curation for top 500 trains (highest data-quality need) | CRIS partnership for authoritative schedule feed |
| Railway track geometry | OSM (Overpass API) | Manual digitization for gaps | Periodic re-sync from OSM |
| Live position (Track A) | NTES scrape (rate-limited, cached) | RapidAPI wrapper as cross-check | Deprecate once Track C live |
| Live position (Track B) | In-app crowd-sourced GPS | — | Becomes primary source as install base grows |
| Live position (Track C) | — (not yet available) | — | CRIS/official partnership, Phase 3 BD effort |
| Historical delay data for ML training | Self-collected from Phase 0 onward + any verifiable public historical archives | — | Grows organically; this is the data moat |

## 14.3 Data Licensing & Attribution Notes

- **OSM data** is licensed under ODbL — requires attribution ("© OpenStreetMap contributors") visible in the UI wherever map data is displayed.
- **data.gov.in** datasets are typically under the National Data Sharing and Accessibility Policy (NDSAP) — generally permissive but check per-dataset license terms.
- Any **scraped data** (NTES) should be presented with a disclaimer: *"Live status is estimated from publicly available sources and may differ from official Indian Railways information. For official information, refer to NTES (enquiry.indianrail.gov.in) or 139."*
