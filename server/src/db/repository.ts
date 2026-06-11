import { getDb } from "./connection.js";

export interface TrainSummaryRow {
  train_number: string;
  name: string;
  name_local: string | null;
  source_station: string;
  destination_station: string;
  train_type: string;
}

export interface TrainRow extends TrainSummaryRow {
  zone: string | null;
  total_distance_km: number | null;
  average_speed_kmph: number | null;
  runs_on_days: string;
  origin_departure_hour: number | null;
  origin_departure_minute: number | null;
  scheduled_duration_min: number | null;
  has_full_data: number;
}

export interface RouteStationRow {
  sequence_number: number;
  station_code: string;
  station_name: string;
  lat: number;
  lon: number;
  distance_from_source_km: number;
  scheduled_arrival_offset_min: number | null;
  scheduled_departure_offset_min: number | null;
  halt_minutes: number;
  platform_number: string | null;
}

export interface TrainRunRow {
  id: number;
  train_number: string;
  run_date: string;
  status: string;
  data_quality: string;
  final_delay_min: number | null;
  avg_speed_kmph: number | null;
  current_index: number | null;
  predicted_from_index: number | null;
  position_distance_km: number | null;
  position_speed_kmph: number | null;
  source: string | null;
}

export interface StationEventRow {
  sequence_number: number;
  station_code: string;
  station_name: string;
  scheduled_arrival_offset_min: number | null;
  scheduled_departure_offset_min: number | null;
  actual_arrival_offset_min: number | null;
  actual_departure_offset_min: number | null;
  arrival_delay_min: number | null;
  departure_delay_min: number | null;
}

export function getTrain(trainNumber: string): TrainRow | undefined {
  const db = getDb();
  return db.prepare(`SELECT * FROM trains WHERE train_number = ?`).get(trainNumber) as TrainRow | undefined;
}

export function searchTrains(query: string, limit: number): TrainSummaryRow[] {
  const db = getDb();
  const q = query.trim().toLowerCase();
  if (!q) {
    return db
      .prepare(`SELECT train_number, name, name_local, source_station, destination_station, train_type FROM trains LIMIT ?`)
      .all(limit) as unknown as TrainSummaryRow[];
  }
  return db
    .prepare(
      `SELECT train_number, name, name_local, source_station, destination_station, train_type
       FROM trains
       WHERE train_number LIKE ? OR lower(name) LIKE ? OR lower(source_station) LIKE ? OR lower(destination_station) LIKE ?
       LIMIT ?`
    )
    .all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, limit) as unknown as TrainSummaryRow[];
}

export function getRoute(trainNumber: string): RouteStationRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT rs.sequence_number, rs.station_code, s.name as station_name, s.lat, s.lon,
              rs.distance_from_source_km,
              rs.scheduled_arrival_offset_min, rs.scheduled_departure_offset_min,
              rs.halt_minutes, rs.platform_number
       FROM route_stations rs
       JOIN stations s ON s.code = rs.station_code
       WHERE rs.train_number = ?
       ORDER BY rs.sequence_number`
    )
    .all(trainNumber) as unknown as RouteStationRow[];
}

export function getRunByDate(trainNumber: string, runDate: string): TrainRunRow | undefined {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM train_runs WHERE train_number = ? AND run_date = ?`)
    .get(trainNumber, runDate) as TrainRunRow | undefined;
}

export function getTodayRun(trainNumber: string): TrainRunRow | undefined {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM train_runs WHERE train_number = ? AND status = 'running' ORDER BY run_date DESC LIMIT 1`)
    .get(trainNumber) as TrainRunRow | undefined;
}

export function getStationEvents(runId: number): StationEventRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT se.sequence_number, se.station_code, s.name as station_name,
              se.scheduled_arrival_offset_min, se.scheduled_departure_offset_min,
              se.actual_arrival_offset_min, se.actual_departure_offset_min,
              se.arrival_delay_min, se.departure_delay_min
       FROM station_events se
       JOIN stations s ON s.code = se.station_code
       WHERE se.run_id = ?
       ORDER BY se.sequence_number`
    )
    .all(runId) as unknown as StationEventRow[];
}

export function getRuns(trainNumber: string, from?: string, to?: string): TrainRunRow[] {
  const db = getDb();
  let sql = `SELECT * FROM train_runs WHERE train_number = ?`;
  const params: (string | number)[] = [trainNumber];
  if (from) {
    sql += ` AND run_date >= ?`;
    params.push(from);
  }
  if (to) {
    sql += ` AND run_date <= ?`;
    params.push(to);
  }
  sql += ` ORDER BY run_date DESC`;
  return db.prepare(sql).all(...params) as unknown as TrainRunRow[];
}

export function getReliabilityRow(trainNumber: string) {
  const db = getDb();
  return db.prepare(`SELECT * FROM reliability_scores WHERE train_number = ?`).get(trainNumber) as
    | {
        train_number: string;
        computed_at: string;
        score: number;
        punctuality: number;
        consistency: number;
        cancellations: number;
        severe_delays: number;
        best_month_label: string | null;
        best_month_score: number | null;
        worst_month_label: string | null;
        worst_month_score: number | null;
      }
    | undefined;
}

export function getInsights(trainNumber: string) {
  const db = getDb();
  return db
    .prepare(`SELECT run_date, text, generated_at, confidence FROM ai_insights WHERE train_number = ? ORDER BY run_date DESC`)
    .all(trainNumber) as { run_date: string; text: string; generated_at: string; confidence: number }[];
}

/** Average arrival delay (minutes) per intermediate station, over
 * `completed` runs in the last `days` days. */
export function getStationAverageDelays(trainNumber: string, days: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT se.station_code, s.name as station_name, se.sequence_number,
              AVG(se.arrival_delay_min) as avg_delay
       FROM station_events se
       JOIN train_runs tr ON tr.id = se.run_id
       JOIN stations s ON s.code = se.station_code
       WHERE tr.train_number = ? AND tr.status = 'completed'
         AND se.sequence_number > 1 AND se.arrival_delay_min IS NOT NULL
         AND tr.run_date >= date('now', '-' || ? || ' days')
       GROUP BY se.station_code, s.name, se.sequence_number
       ORDER BY se.sequence_number`
    )
    .all(trainNumber, days) as { station_code: string; station_name: string; sequence_number: number; avg_delay: number }[];
}

/** Per-day average arrival delay (intermediate stations) over the last
 * `days` days, oldest first. Cancelled/no-data days are returned with
 * delay 0. */
export function getDailyDelayTrend(trainNumber: string, days: number) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tr.run_date, AVG(se.arrival_delay_min) as avg_delay
       FROM train_runs tr
       LEFT JOIN station_events se ON se.run_id = tr.id AND se.sequence_number > 1
       WHERE tr.train_number = ? AND tr.status != 'running'
         AND tr.run_date >= date('now', '-' || ? || ' days')
       GROUP BY tr.run_date
       ORDER BY tr.run_date ASC`
    )
    .all(trainNumber, days) as { run_date: string; avg_delay: number | null }[];
  return rows;
}

/** Average arrival delay (intermediate stations) grouped by day-of-week
 * (0 = Sunday .. 6 = Saturday, per SQLite's `%w`), over the last `days`
 * days of completed runs. */
export function getDayOfWeekDelays(trainNumber: string, days: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT CAST(strftime('%w', tr.run_date) AS INTEGER) as dow, AVG(se.arrival_delay_min) as avg_delay
       FROM station_events se
       JOIN train_runs tr ON tr.id = se.run_id
       WHERE tr.train_number = ? AND tr.status = 'completed'
         AND se.sequence_number > 1 AND se.arrival_delay_min IS NOT NULL
         AND tr.run_date >= date('now', '-' || ? || ' days')
       GROUP BY dow`
    )
    .all(trainNumber, days) as { dow: number; avg_delay: number }[];
}

/** Overall stats (avg/max delay, punctuality %, avg speed) over the last
 * `days` days of completed runs. */
export function getOverallStats(trainNumber: string, days: number) {
  const db = getDb();
  return db
    .prepare(
      `SELECT AVG(se.arrival_delay_min) as avg_delay,
              MAX(se.arrival_delay_min) as max_delay,
              AVG(CASE WHEN se.arrival_delay_min <= 15 THEN 1.0 ELSE 0.0 END) as punctuality_frac,
              (SELECT AVG(avg_speed_kmph) FROM train_runs
                 WHERE train_number = ? AND status = 'completed' AND run_date >= date('now', '-' || ? || ' days')) as avg_speed
       FROM station_events se
       JOIN train_runs tr ON tr.id = se.run_id
       WHERE tr.train_number = ? AND tr.status = 'completed'
         AND se.sequence_number > 1 AND se.arrival_delay_min IS NOT NULL
         AND tr.run_date >= date('now', '-' || ? || ' days')`
    )
    .get(trainNumber, days, trainNumber, days) as {
    avg_delay: number | null;
    max_delay: number | null;
    punctuality_frac: number | null;
    avg_speed: number | null;
  };
}
