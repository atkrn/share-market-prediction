-- RailPulse API database schema (SQLite).
--
-- This is a simplified, single-file stand-in for the PostgreSQL +
-- PostGIS + TimescaleDB schema described in
-- docs/rail-intelligence-platform/05-database-schema.md. Table names and
-- relationships mirror that design (stations, trains, route_stations,
-- train_runs, station_events, reliability_scores, ai_insights) so the
-- migration path to Postgres later is mostly a 1:1 schema port.

CREATE TABLE IF NOT EXISTS stations (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS trains (
  train_number TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_local TEXT,
  source_station TEXT NOT NULL REFERENCES stations(code),
  destination_station TEXT NOT NULL REFERENCES stations(code),
  train_type TEXT NOT NULL,
  zone TEXT,
  total_distance_km REAL,
  average_speed_kmph REAL,
  runs_on_days TEXT NOT NULL DEFAULT '1111111',
  origin_departure_hour INTEGER,
  origin_departure_minute INTEGER,
  scheduled_duration_min INTEGER,
  -- 1 = full route/run/analytics data is seeded; 0 = search-only
  -- ("coming soon") placeholder, per the phased rollout in the PRD.
  has_full_data INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS route_stations (
  train_number TEXT NOT NULL REFERENCES trains(train_number),
  sequence_number INTEGER NOT NULL,
  station_code TEXT NOT NULL REFERENCES stations(code),
  distance_from_source_km REAL NOT NULL,
  scheduled_arrival_offset_min INTEGER,
  scheduled_departure_offset_min INTEGER,
  halt_minutes INTEGER NOT NULL DEFAULT 0,
  platform_number TEXT,
  PRIMARY KEY (train_number, sequence_number)
);

-- One row per (train, calendar date) -- an actual journey instance.
CREATE TABLE IF NOT EXISTS train_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  train_number TEXT NOT NULL REFERENCES trains(train_number),
  run_date TEXT NOT NULL,
  status TEXT NOT NULL,
  data_quality TEXT NOT NULL,
  final_delay_min INTEGER,
  avg_speed_kmph REAL,
  -- live-run fields (only meaningful while status = 'running')
  current_index INTEGER,
  predicted_from_index INTEGER,
  position_distance_km REAL,
  position_speed_kmph REAL,
  source TEXT,
  UNIQUE (train_number, run_date)
);

CREATE INDEX IF NOT EXISTS idx_train_runs_train_date
  ON train_runs (train_number, run_date);

-- Actual arrival/departure per station per run. Delay columns are
-- pre-computed (actual - scheduled) at seed/ingest time, matching the
-- "generated columns" approach noted in the schema doc.
CREATE TABLE IF NOT EXISTS station_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES train_runs(id),
  sequence_number INTEGER NOT NULL,
  station_code TEXT NOT NULL REFERENCES stations(code),
  scheduled_arrival_offset_min INTEGER,
  scheduled_departure_offset_min INTEGER,
  actual_arrival_offset_min INTEGER,
  actual_departure_offset_min INTEGER,
  arrival_delay_min INTEGER,
  departure_delay_min INTEGER,
  UNIQUE (run_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_station_events_run
  ON station_events (run_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_station_events_station
  ON station_events (station_code);

-- Pre-computed reliability score (see docs §4.4.1 for the formula);
-- recomputed by the seed script from the generated run history.
CREATE TABLE IF NOT EXISTS reliability_scores (
  train_number TEXT PRIMARY KEY REFERENCES trains(train_number),
  computed_at TEXT NOT NULL,
  score REAL NOT NULL,
  punctuality REAL NOT NULL,
  consistency REAL NOT NULL,
  cancellations REAL NOT NULL,
  severe_delays REAL NOT NULL,
  best_month_label TEXT,
  best_month_score REAL,
  worst_month_label TEXT,
  worst_month_score REAL
);

-- Cached natural-language insight text per run (see §15.6).
CREATE TABLE IF NOT EXISTS ai_insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  train_number TEXT NOT NULL REFERENCES trains(train_number),
  run_date TEXT NOT NULL,
  text TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  confidence REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_train
  ON ai_insights (train_number, run_date DESC);
