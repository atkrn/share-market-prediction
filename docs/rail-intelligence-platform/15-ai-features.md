# 15. AI / ML Features

## 15.1 Delay Prediction Model

**Goal:** predict arrival delay (minutes) at the next station and at the destination, given the train's current state.

- **Model type:** Gradient-boosted trees (XGBoost/LightGBM) — tabular data, fast inference, explainable via SHAP, robust with moderate data volumes (consistent with the choices in the existing `app.py` stock-prediction codebase in this repo, which already uses this pattern for time-series forecasting).
- **Features:**
  - Current delay (minutes), delay at last 1-3 stations
  - Distance/time to next station, scheduled halt durations ahead
  - Time of day, day of week, month/season
  - Train type, route segment (zone/division)
  - Historical average delay for this train at this station (last 30/90 days)
  - Recent network-wide congestion signal (avg delay of other trains on same route segment in last hour)
  - Weather (optional V2: fog season on North Indian routes is a major, well-known delay driver)
- **Target:** delay in minutes at arrival (regression); secondary classification target: `further_delay_probability` = P(delay increases by >5 min before destination).
- **Training pipeline:** Airflow DAG, retrains weekly on rolling 6-12 month window; versioned models in S3, served via Prediction Service with `model_version` recorded on every prediction (enables rollback and A/B evaluation).
- **Evaluation:** median absolute error (MAE) on held-out recent data; target ≤8 min for next-station ETA (per [§2.5](02-prd.md#25-success-metrics-north-star--supporting)). Track per-train accuracy — trains with sparse data fall back to rule-based ETA ("current delay carries forward") with a low confidence score.

## 15.2 Confidence Score

- Derived from the model's prediction interval (e.g., quantile regression at 10th/90th percentile, or residual-based historical error distribution for this train/station).
- Displayed as a percentage; UI maps to plain language: >80% "High confidence", 50-80% "Moderate", <50% "Low — limited historical data".

## 15.3 Congestion Forecasting (V2)

- **Goal:** predict near-term (next 1-3 hours) delay risk for a route segment based on current network state — "Trains on the Delhi-Agra section are currently averaging +20 min due to congestion near Mathura."
- **Approach:** time-series model (Prophet or simple exponential smoothing) on segment-level average delay, updated continuously from live `position_logs`/`station_events` across all trains on that segment.
- **Use case:** feeds both the predictive ETA model (as a feature) and a standalone "network status" view for ops users.

## 15.4 Route Anomaly Detection

- **Goal:** flag operationally unusual events in near-real-time:
  - Unscheduled long halt (stopped >15 min where no scheduled halt exists)
  - Route deviation (position significantly off the expected route geometry — possible diversion)
  - Speed anomaly (sudden drop to near-zero mid-section, or implausible speed spike — possible GPS error or genuine incident)
  - GPS gap (no position update for >X minutes during a `running` status)
- **Approach:** rule-based thresholds for V1 (transparent, debuggable); **Isolation Forest** or simple statistical (z-score vs historical norms for that segment) for V1.5+ to catch subtler anomalies.
- **Output:** writes to `anomalies` table; surfaces in ops dashboard ([US-13](03-user-stories.md#35-railway-operations-staff-officer-singh)) and can trigger AI insight generation.

## 15.5 Reliability / Performance Scoring

- See formula in [§4.4.1](04-feature-breakdown.md#441-reliability-score-formula-v1) — deliberately **transparent and explainable** (not a black-box ML score) to build user trust, since this is a user-facing trust signal.
- V2 enhancement: a secondary **ML-derived "predictability" score** (how well the rule-based formula's inputs actually correlate with user-perceived experience) could be researched, but the primary score stays formula-based.

## 15.6 AI-Generated Operational Insights (NLG)

**Goal:** produce sentences like:
> "Train 12002 has recovered 18 minutes during the last 4 stations and is expected to reach New Delhi only 7 minutes late."

### Recommended hybrid approach

1. **Structured facts layer** — the Analytics/Prediction services compute a small JSON "fact sheet" per run: current delay, delay trend (recovering/worsening/stable), recovery amount over last N stations, predicted final delay, confidence, any active anomalies.
2. **Template tier (covers ~80% of cases, instant, zero hallucination risk):**
   - `"{train_name} has recovered {recovery_min} minutes over the last {n} stations and is expected to reach {destination} {final_delay} late."`
   - `"{train_name} is running {early_min} minutes ahead of schedule."`
   - `"{train_name} has been delayed by {delay_min} minutes, primarily due to a {halt_min}-minute halt at {station}."`
3. **LLM tier (for complex/multi-factor situations not covered by templates):** call Claude API with the structured fact sheet as grounded context, explicit instruction to **only reference provided facts** (no speculation), output 1-2 sentences, both English and Hindi. Cache the result keyed on the fact-sheet hash so identical states don't regenerate.
4. **Explainability:** every insight stores `supporting_data` (the fact sheet used) so the UI can show "why" on tap — critical for analyst trust (US-14).

### Example fact sheet → insight

```json
{
  "train_number": "12002",
  "current_delay_min": 7,
  "delay_trend": "recovering",
  "recovery_last_n_stations": { "n": 4, "recovered_min": 18 },
  "predicted_final_delay_min": 7,
  "confidence": 0.82,
  "destination": "New Delhi"
}
```
→ *"Train 12002 has recovered 18 minutes during the last 4 stations and is expected to reach New Delhi only 7 minutes late."*

## 15.7 Model Governance

- All model versions logged with training data window, evaluation metrics, and deployment date.
- Shadow-mode evaluation for new model versions (compute predictions but don't serve) for 1-2 weeks before promotion.
- Bias/quality monitoring: per-train and per-zone accuracy dashboards — important given data density varies a lot by train/route (a model that's accurate for Rajdhanis but poor for branch-line passenger trains should surface that gap rather than hide it behind an aggregate metric).
