-- ════════════════════════════════════════════════════════════════
--  Indian Rail Live Intelligence Platform — Database Schema
--  PostgreSQL 16 + PostGIS + TimescaleDB
-- ════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- for fuzzy train/station name search

-- ────────────────────────────────────────────────────────────────
--  REFERENCE DATA
-- ────────────────────────────────────────────────────────────────

CREATE TABLE stations (
    station_code        VARCHAR(8)      PRIMARY KEY,         -- e.g. 'NDLS'
    name                VARCHAR(120)    NOT NULL,
    name_local          VARCHAR(120),                        -- e.g. Hindi script name
    state               VARCHAR(60),
    zone                VARCHAR(10),                         -- e.g. 'NR', 'WR'
    division            VARCHAR(60),
    geom                GEOGRAPHY(POINT, 4326) NOT NULL,
    elevation_m         NUMERIC(7,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stations_geom ON stations USING GIST (geom);
CREATE INDEX idx_stations_name_trgm ON stations USING GIN (name gin_trgm_ops);

CREATE TYPE train_type AS ENUM (
    'rajdhani', 'shatabdi', 'vande_bharat', 'duronto', 'humsafar',
    'tejas', 'mail_express', 'superfast', 'passenger', 'suburban',
    'memu', 'demu', 'freight', 'other'
);

CREATE TABLE trains (
    train_number        VARCHAR(6)      PRIMARY KEY,         -- e.g. '12301'
    name                VARCHAR(150)    NOT NULL,
    name_local          VARCHAR(150),
    train_type          train_type      NOT NULL DEFAULT 'other',
    source_station_code VARCHAR(8)      NOT NULL REFERENCES stations(station_code),
    destination_station_code VARCHAR(8) NOT NULL REFERENCES stations(station_code),
    zone                VARCHAR(10),
    runs_on_days        BIT(7)          NOT NULL DEFAULT B'1111111', -- Mon..Sun
    total_distance_km   NUMERIC(8,2),
    average_speed_kmph  NUMERIC(6,2),
    rake_type           VARCHAR(40),     -- LHB, ICF, Vande Bharat trainset, etc.
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trains_name_trgm ON trains USING GIN (name gin_trgm_ops);
CREATE INDEX idx_trains_route ON trains (source_station_code, destination_station_code);

-- Static timetable: ordered list of stations per train with scheduled offsets
CREATE TABLE route_stations (
    id                      BIGSERIAL PRIMARY KEY,
    train_number            VARCHAR(6)  NOT NULL REFERENCES trains(train_number) ON DELETE CASCADE,
    sequence_number         SMALLINT    NOT NULL,            -- 1-based order along route
    station_code            VARCHAR(8)  NOT NULL REFERENCES stations(station_code),
    distance_from_source_km NUMERIC(8,2) NOT NULL,
    scheduled_arrival_offset   INTERVAL,                     -- NULL for origin station
    scheduled_departure_offset INTERVAL,                     -- NULL for terminus station
    halt_minutes            SMALLINT NOT NULL DEFAULT 0,
    platform_number         VARCHAR(6),
    day_number              SMALLINT NOT NULL DEFAULT 1,     -- journey day (multi-day trains)
    UNIQUE (train_number, sequence_number)
);
CREATE INDEX idx_route_stations_train ON route_stations (train_number, sequence_number);
CREATE INDEX idx_route_stations_station ON route_stations (station_code);

-- Precomputed route geometry (for map rendering / map-matching)
CREATE TABLE route_geometries (
    train_number    VARCHAR(6) PRIMARY KEY REFERENCES trains(train_number) ON DELETE CASCADE,
    geom            GEOGRAPHY(LINESTRING, 4326) NOT NULL,
    source          VARCHAR(20) NOT NULL DEFAULT 'osm',      -- 'osm' | 'manual' | 'derived'
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_route_geometries_geom ON route_geometries USING GIST (geom);

-- ────────────────────────────────────────────────────────────────
--  RUN-LEVEL (DAILY JOURNEY INSTANCE) DATA
-- ────────────────────────────────────────────────────────────────

CREATE TYPE run_status AS ENUM (
    'scheduled', 'running', 'completed', 'partially_completed',
    'cancelled', 'terminated_early', 'rescheduled'
);

CREATE TYPE data_quality AS ENUM ('high', 'medium', 'low', 'interpolated');

CREATE TABLE train_runs (
    id                  BIGSERIAL PRIMARY KEY,
    train_number        VARCHAR(6)  NOT NULL REFERENCES trains(train_number),
    run_date            DATE        NOT NULL,                 -- date train departs origin
    status              run_status  NOT NULL DEFAULT 'scheduled',
    data_quality        data_quality NOT NULL DEFAULT 'medium',
    actual_start_time   TIMESTAMPTZ,
    actual_end_time     TIMESTAMPTZ,
    total_distance_km   NUMERIC(8,2),
    average_speed_kmph  NUMERIC(6,2),
    final_delay_minutes INTEGER,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (train_number, run_date)
);
CREATE INDEX idx_train_runs_train_date ON train_runs (train_number, run_date DESC);
CREATE INDEX idx_train_runs_status ON train_runs (status) WHERE status = 'running';

-- Raw GPS pings — TimescaleDB hypertable (high volume)
CREATE TYPE position_source AS ENUM ('crowd_gps', 'ntes_scrape', 'official_feed', 'interpolated');

CREATE TABLE position_logs (
    run_id          BIGINT      NOT NULL REFERENCES train_runs(id) ON DELETE CASCADE,
    recorded_at     TIMESTAMPTZ NOT NULL,
    geom            GEOGRAPHY(POINT, 4326) NOT NULL,
    speed_kmph      NUMERIC(6,2),
    heading_degrees NUMERIC(5,2),
    accuracy_m      NUMERIC(8,2),
    source          position_source NOT NULL DEFAULT 'crowd_gps',
    distance_from_source_km NUMERIC(8,2),                     -- map-matched distance along route
    PRIMARY KEY (run_id, recorded_at)
);
SELECT create_hypertable('position_logs', 'recorded_at', chunk_time_interval => INTERVAL '1 day');
CREATE INDEX idx_position_logs_run ON position_logs (run_id, recorded_at DESC);
CREATE INDEX idx_position_logs_geom ON position_logs USING GIST (geom);

-- Compress + retain raw pings; aggregated tables below retain indefinitely
ALTER TABLE position_logs SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'run_id'
);
SELECT add_compression_policy('position_logs', INTERVAL '30 days');
SELECT add_retention_policy('position_logs', INTERVAL '730 days');

-- Actual vs scheduled per station per run
CREATE TABLE station_events (
    id                      BIGSERIAL PRIMARY KEY,
    run_id                  BIGINT  NOT NULL REFERENCES train_runs(id) ON DELETE CASCADE,
    station_code            VARCHAR(8) NOT NULL REFERENCES stations(station_code),
    sequence_number         SMALLINT NOT NULL,
    scheduled_arrival       TIMESTAMPTZ,
    actual_arrival          TIMESTAMPTZ,
    scheduled_departure     TIMESTAMPTZ,
    actual_departure        TIMESTAMPTZ,
    platform_actual         VARCHAR(6),
    arrival_delay_minutes   INTEGER GENERATED ALWAYS AS (
        CASE WHEN actual_arrival IS NOT NULL AND scheduled_arrival IS NOT NULL
             THEN ROUND(EXTRACT(EPOCH FROM (actual_arrival - scheduled_arrival)) / 60)
             ELSE NULL END
    ) STORED,
    departure_delay_minutes INTEGER GENERATED ALWAYS AS (
        CASE WHEN actual_departure IS NOT NULL AND scheduled_departure IS NOT NULL
             THEN ROUND(EXTRACT(EPOCH FROM (actual_departure - scheduled_departure)) / 60)
             ELSE NULL END
    ) STORED,
    halt_actual_minutes     INTEGER GENERATED ALWAYS AS (
        CASE WHEN actual_arrival IS NOT NULL AND actual_departure IS NOT NULL
             THEN ROUND(EXTRACT(EPOCH FROM (actual_departure - actual_arrival)) / 60)
             ELSE NULL END
    ) STORED,
    UNIQUE (run_id, sequence_number)
);
CREATE INDEX idx_station_events_run ON station_events (run_id, sequence_number);
CREATE INDEX idx_station_events_station ON station_events (station_code, scheduled_arrival);

-- ────────────────────────────────────────────────────────────────
--  ANALYTICS / AI
-- ────────────────────────────────────────────────────────────────

CREATE TABLE reliability_scores (
    id              BIGSERIAL PRIMARY KEY,
    train_number    VARCHAR(6) NOT NULL REFERENCES trains(train_number),
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    score           NUMERIC(5,2) NOT NULL CHECK (score BETWEEN 0 AND 100),
    components      JSONB NOT NULL,        -- {"punctuality": -12.3, "consistency": -8.1, ...}
    window_days     SMALLINT NOT NULL DEFAULT 30,
    UNIQUE (train_number, computed_at)
);
CREATE INDEX idx_reliability_train_latest ON reliability_scores (train_number, computed_at DESC);

CREATE TABLE predictions (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              BIGINT NOT NULL REFERENCES train_runs(id) ON DELETE CASCADE,
    station_code        VARCHAR(8) NOT NULL REFERENCES stations(station_code),
    predicted_arrival   TIMESTAMPTZ,
    predicted_departure TIMESTAMPTZ,
    confidence_score    NUMERIC(4,3) CHECK (confidence_score BETWEEN 0 AND 1),
    predicted_delay_minutes INTEGER,
    further_delay_probability NUMERIC(4,3),
    model_version       VARCHAR(40) NOT NULL,
    predicted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_predictions_run_station ON predictions (run_id, station_code, predicted_at DESC);

CREATE TYPE anomaly_type AS ENUM (
    'unscheduled_long_halt', 'route_deviation', 'speed_anomaly',
    'gps_gap', 'sudden_delay_spike', 'early_arrival_anomaly'
);

CREATE TABLE anomalies (
    id              BIGSERIAL PRIMARY KEY,
    run_id          BIGINT NOT NULL REFERENCES train_runs(id) ON DELETE CASCADE,
    anomaly_type    anomaly_type NOT NULL,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    location_geom   GEOGRAPHY(POINT, 4326),
    details         JSONB NOT NULL DEFAULT '{}'::jsonb,
    severity        SMALLINT NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 5)
);
CREATE INDEX idx_anomalies_run ON anomalies (run_id);

CREATE TABLE ai_insights (
    id              BIGSERIAL PRIMARY KEY,
    run_id          BIGINT NOT NULL REFERENCES train_runs(id) ON DELETE CASCADE,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    insight_text    TEXT NOT NULL,
    insight_text_local TEXT,                -- Hindi translation
    supporting_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    model_version   VARCHAR(40) NOT NULL
);
CREATE INDEX idx_ai_insights_run ON ai_insights (run_id, generated_at DESC);

-- Materialized view: rolling 7/30-day delay stats per train (refreshed hourly)
CREATE MATERIALIZED VIEW train_delay_stats AS
SELECT
    tr.train_number,
    AVG(tr.final_delay_minutes) FILTER (WHERE tr.run_date >= CURRENT_DATE - 7)  AS avg_delay_7d,
    AVG(tr.final_delay_minutes) FILTER (WHERE tr.run_date >= CURRENT_DATE - 30) AS avg_delay_30d,
    STDDEV(tr.final_delay_minutes) FILTER (WHERE tr.run_date >= CURRENT_DATE - 30) AS stddev_delay_30d,
    MAX(tr.final_delay_minutes) FILTER (WHERE tr.run_date >= CURRENT_DATE - 30) AS max_delay_30d,
    COUNT(*) FILTER (WHERE tr.run_date >= CURRENT_DATE - 30) AS runs_30d,
    COUNT(*) FILTER (WHERE tr.status = 'cancelled' AND tr.run_date >= CURRENT_DATE - 30) AS cancellations_30d,
    COUNT(*) FILTER (WHERE tr.final_delay_minutes > 60 AND tr.run_date >= CURRENT_DATE - 30) AS severe_delays_30d
FROM train_runs tr
WHERE tr.status IN ('completed', 'partially_completed', 'cancelled')
GROUP BY tr.train_number;
CREATE UNIQUE INDEX idx_train_delay_stats_train ON train_delay_stats (train_number);

-- ────────────────────────────────────────────────────────────────
--  USERS / ACCOUNTS / ALERTS / API
-- ────────────────────────────────────────────────────────────────

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    phone           VARCHAR(15) UNIQUE,
    email           VARCHAR(255) UNIQUE,
    name            VARCHAR(120),
    language_pref   VARCHAR(5) NOT NULL DEFAULT 'en',
    plan_tier       VARCHAR(20) NOT NULL DEFAULT 'free',     -- free | premium | enterprise
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (phone IS NOT NULL OR email IS NOT NULL)
);

CREATE TABLE favorites (
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    train_number    VARCHAR(6) NOT NULL REFERENCES trains(train_number),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, train_number)
);

CREATE TYPE alert_channel AS ENUM ('push', 'sms', 'email', 'whatsapp');

CREATE TABLE alerts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    train_number    VARCHAR(6) NOT NULL REFERENCES trains(train_number),
    threshold_minutes SMALLINT NOT NULL DEFAULT 15,
    channel         alert_channel NOT NULL DEFAULT 'push',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_alerts_train_active ON alerts (train_number) WHERE active;

CREATE TABLE notifications_log (
    id              BIGSERIAL PRIMARY KEY,
    alert_id        BIGINT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    channel         alert_channel NOT NULL,
    payload         JSONB NOT NULL,
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'sent'
);

CREATE TABLE api_keys (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash        VARCHAR(128) NOT NULL UNIQUE,
    label           VARCHAR(80),
    tier            VARCHAR(20) NOT NULL DEFAULT 'free',     -- free | partner | enterprise
    rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at    TIMESTAMPTZ
);
