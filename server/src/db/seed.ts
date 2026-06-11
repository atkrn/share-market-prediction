import { getDb, DB_PATH } from "./connection.js";
import { mulberry32, hashStr } from "../lib/rng.js";
import { buildRun, generateHistoricalRun } from "../lib/runGeneration.js";
import type { RouteStationRow, TrainRow } from "../types.js";

/**
 * Seeds the SQLite database with the same trains/routes/today's-live-run
 * shown by the web app's mock data (web/src/lib/data/trains.ts), plus
 * `HISTORY_DAYS` of synthetic-but-deterministic historical runs so that
 * /analytics, /reliability and /runs have real rows to query instead of
 * being computed inline. Re-running this script wipes and re-seeds.
 */

const HISTORY_DAYS = 180;

interface StationSeed {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

const STATIONS: StationSeed[] = [
  { code: "NDLS", name: "New Delhi", lat: 28.6429, lon: 77.2191 },
  { code: "MTJ", name: "Mathura Jn", lat: 27.4924, lon: 77.6737 },
  { code: "KOTA", name: "Kota Jn", lat: 25.1804, lon: 75.8648 },
  { code: "BRC", name: "Vadodara Jn", lat: 22.3072, lon: 73.1812 },
  { code: "ST", name: "Surat", lat: 21.1702, lon: 72.8311 },
  { code: "BVI", name: "Borivali", lat: 19.2288, lon: 72.8567 },
  { code: "BCT", name: "Mumbai Central", lat: 18.9696, lon: 72.8205 },
  { code: "AGC", name: "Agra Cantt", lat: 27.1592, lon: 78.0092 },
  { code: "GWL", name: "Gwalior Jn", lat: 26.2183, lon: 78.1828 },
  { code: "JHS", name: "Jhansi Jn", lat: 25.4484, lon: 78.5685 },
  { code: "BPL", name: "Bhopal Jn", lat: 23.2599, lon: 77.4126 },
  { code: "HWH", name: "Howrah Jn", lat: 22.5839, lon: 88.3425 },
  { code: "SDAH", name: "Sealdah", lat: 22.5675, lon: 88.3708 },
  { code: "TVC", name: "Thiruvananthapuram Central", lat: 8.4875, lon: 76.9525 },
  { code: "BDTS", name: "Bandra Terminus", lat: 19.0544, lon: 72.8406 },
  { code: "NZM", name: "Hazrat Nizamuddin", lat: 28.5933, lon: 77.2507 },
];

interface TrainSummarySeed {
  trainNumber: string;
  name: string;
  nameLocal: string;
  sourceStation: string;
  destinationStation: string;
  trainType: string;
}

const TRAIN_SUMMARIES: TrainSummarySeed[] = [
  { trainNumber: "12951", name: "Mumbai Rajdhani", nameLocal: "मुंबई राजधानी", sourceStation: "NDLS", destinationStation: "BCT", trainType: "rajdhani" },
  { trainNumber: "12002", name: "Bhopal Shatabdi", nameLocal: "भोपाल शताब्दी", sourceStation: "NDLS", destinationStation: "BPL", trainType: "shatabdi" },
  { trainNumber: "12301", name: "Howrah Rajdhani", nameLocal: "हावड़ा राजधानी", sourceStation: "NDLS", destinationStation: "HWH", trainType: "rajdhani" },
  { trainNumber: "12259", name: "Sealdah Duronto", nameLocal: "सियालदह दुरंतो", sourceStation: "NDLS", destinationStation: "SDAH", trainType: "duronto" },
  { trainNumber: "12626", name: "Kerala Express", nameLocal: "केरल एक्सप्रेस", sourceStation: "NDLS", destinationStation: "TVC", trainType: "superfast" },
  { trainNumber: "12909", name: "Garib Rath Express", nameLocal: "गरीब रथ एक्सप्रेस", sourceStation: "BDTS", destinationStation: "NZM", trainType: "express" },
];

const MUMBAI_RAJDHANI_ROUTE: RouteStationRow[] = [
  { trainNumber: "12951", sequenceNumber: 1, stationCode: "NDLS", stationName: "New Delhi", lat: 28.6429, lon: 77.2191, distanceFromSourceKm: 0, scheduledArrivalOffsetMin: null, scheduledDepartureOffsetMin: 0, haltMinutes: 0, platformNumber: "1" },
  { trainNumber: "12951", sequenceNumber: 2, stationCode: "MTJ", stationName: "Mathura Jn", lat: 27.4924, lon: 77.6737, distanceFromSourceKm: 141, scheduledArrivalOffsetMin: 130, scheduledDepartureOffsetMin: 132, haltMinutes: 2, platformNumber: "3" },
  { trainNumber: "12951", sequenceNumber: 3, stationCode: "KOTA", stationName: "Kota Jn", lat: 25.1804, lon: 75.8648, distanceFromSourceKm: 463, scheduledArrivalOffsetMin: 278, scheduledDepartureOffsetMin: 283, haltMinutes: 5, platformNumber: "2" },
  { trainNumber: "12951", sequenceNumber: 4, stationCode: "BRC", stationName: "Vadodara Jn", lat: 22.3072, lon: 73.1812, distanceFromSourceKm: 944, scheduledArrivalOffsetMin: 535, scheduledDepartureOffsetMin: 540, haltMinutes: 5, platformNumber: "1" },
  { trainNumber: "12951", sequenceNumber: 5, stationCode: "ST", stationName: "Surat", lat: 21.1702, lon: 72.8311, distanceFromSourceKm: 1027, scheduledArrivalOffsetMin: 593, scheduledDepartureOffsetMin: 595, haltMinutes: 2, platformNumber: "2" },
  { trainNumber: "12951", sequenceNumber: 6, stationCode: "BVI", stationName: "Borivali", lat: 19.2288, lon: 72.8567, distanceFromSourceKm: 1349, scheduledArrivalOffsetMin: 787, scheduledDepartureOffsetMin: 789, haltMinutes: 2, platformNumber: "5" },
  { trainNumber: "12951", sequenceNumber: 7, stationCode: "BCT", stationName: "Mumbai Central", lat: 18.9696, lon: 72.8205, distanceFromSourceKm: 1384, scheduledArrivalOffsetMin: 820, scheduledDepartureOffsetMin: null, haltMinutes: 0, platformNumber: "-" },
];

const BHOPAL_SHATABDI_ROUTE: RouteStationRow[] = [
  { trainNumber: "12002", sequenceNumber: 1, stationCode: "NDLS", stationName: "New Delhi", lat: 28.6429, lon: 77.2191, distanceFromSourceKm: 0, scheduledArrivalOffsetMin: null, scheduledDepartureOffsetMin: 0, haltMinutes: 0, platformNumber: "1" },
  { trainNumber: "12002", sequenceNumber: 2, stationCode: "AGC", stationName: "Agra Cantt", lat: 27.1592, lon: 78.0092, distanceFromSourceKm: 195, scheduledArrivalOffsetMin: 131, scheduledDepartureOffsetMin: 133, haltMinutes: 2, platformNumber: "1" },
  { trainNumber: "12002", sequenceNumber: 3, stationCode: "GWL", stationName: "Gwalior Jn", lat: 26.2183, lon: 78.1828, distanceFromSourceKm: 308, scheduledArrivalOffsetMin: 213, scheduledDepartureOffsetMin: 215, haltMinutes: 2, platformNumber: "1" },
  { trainNumber: "12002", sequenceNumber: 4, stationCode: "JHS", stationName: "Jhansi Jn", lat: 25.4484, lon: 78.5685, distanceFromSourceKm: 403, scheduledArrivalOffsetMin: 273, scheduledDepartureOffsetMin: 278, haltMinutes: 5, platformNumber: "1" },
  { trainNumber: "12002", sequenceNumber: 5, stationCode: "BPL", stationName: "Bhopal Jn", lat: 23.2599, lon: 77.4126, distanceFromSourceKm: 707, scheduledArrivalOffsetMin: 485, scheduledDepartureOffsetMin: null, haltMinutes: 0, platformNumber: "1" },
];

interface FullTrainSeed {
  meta: TrainRow;
  route: RouteStationRow[];
  liveRun: {
    arrivalDelays: (number | null)[];
    departureDelays: (number | null)[];
    predictedFromIndex: number;
    currentIndex: number;
    positionDistanceKm: number;
    positionSpeedKmph: number;
    source: string;
  };
}

const FULL_TRAINS: FullTrainSeed[] = [
  {
    meta: {
      trainNumber: "12951",
      name: "Mumbai Rajdhani",
      nameLocal: "मुंबई राजधानी",
      sourceStation: "NDLS",
      destinationStation: "BCT",
      trainType: "rajdhani",
      zone: "WR",
      totalDistanceKm: 1384,
      averageSpeedKmph: 76.3,
      runsOnDays: "1111111",
      originDepartureHour: 16,
      originDepartureMinute: 55,
      scheduledDurationMin: 820,
      hasFullData: 1,
    },
    route: MUMBAI_RAJDHANI_ROUTE,
    liveRun: {
      arrivalDelays: [null, 6, 22, 14, 14, 13, 13],
      departureDelays: [0, 8, 22, 13, 14, 13, null],
      predictedFromIndex: 4,
      currentIndex: 3,
      positionDistanceKm: 960,
      positionSpeedKmph: 92,
      source: "crowd_gps",
    },
  },
  {
    meta: {
      trainNumber: "12002",
      name: "Bhopal Shatabdi",
      nameLocal: "भोपाल शताब्दी",
      sourceStation: "NDLS",
      destinationStation: "BPL",
      trainType: "shatabdi",
      zone: "NCR",
      totalDistanceKm: 707,
      averageSpeedKmph: 87.5,
      runsOnDays: "1111111",
      originDepartureHour: 6,
      originDepartureMinute: 0,
      scheduledDurationMin: 485,
      hasFullData: 1,
    },
    route: BHOPAL_SHATABDI_ROUTE,
    liveRun: {
      arrivalDelays: [null, 8, 12, 15, 7],
      departureDelays: [0, 9, 13, 16, null],
      predictedFromIndex: 3,
      currentIndex: 2,
      positionDistanceKm: 340,
      positionSpeedKmph: 95,
      source: "ntes_scrape",
    },
  },
];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[m - 1]} ${y}`;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function stddev(values: number[]): number {
  if (!values.length) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

function main() {
  const db = getDb();

  db.exec(`
    DELETE FROM ai_insights;
    DELETE FROM reliability_scores;
    DELETE FROM station_events;
    DELETE FROM train_runs;
    DELETE FROM route_stations;
    DELETE FROM trains;
    DELETE FROM stations;
  `);

  const insertStation = db.prepare(`INSERT INTO stations (code, name, lat, lon) VALUES (?, ?, ?, ?)`);
  for (const s of STATIONS) insertStation.run(s.code, s.name, s.lat, s.lon);

  const insertTrain = db.prepare(`
    INSERT INTO trains (
      train_number, name, name_local, source_station, destination_station, train_type,
      zone, total_distance_km, average_speed_kmph, runs_on_days,
      origin_departure_hour, origin_departure_minute, scheduled_duration_min, has_full_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const t of TRAIN_SUMMARIES) {
    const full = FULL_TRAINS.find((f) => f.meta.trainNumber === t.trainNumber);
    if (full) {
      const m = full.meta;
      insertTrain.run(
        m.trainNumber, m.name, m.nameLocal, m.sourceStation, m.destinationStation, m.trainType,
        m.zone, m.totalDistanceKm, m.averageSpeedKmph, m.runsOnDays,
        m.originDepartureHour, m.originDepartureMinute, m.scheduledDurationMin, 1
      );
    } else {
      insertTrain.run(
        t.trainNumber, t.name, t.nameLocal, t.sourceStation, t.destinationStation, t.trainType,
        null, null, null, "1111111", null, null, null, 0
      );
    }
  }

  const insertRouteStation = db.prepare(`
    INSERT INTO route_stations (
      train_number, sequence_number, station_code, distance_from_source_km,
      scheduled_arrival_offset_min, scheduled_departure_offset_min, halt_minutes, platform_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRun = db.prepare(`
    INSERT INTO train_runs (
      train_number, run_date, status, data_quality, final_delay_min, avg_speed_kmph,
      current_index, predicted_from_index, position_distance_km, position_speed_kmph, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO station_events (
      run_id, sequence_number, station_code, scheduled_arrival_offset_min, scheduled_departure_offset_min,
      actual_arrival_offset_min, actual_departure_offset_min, arrival_delay_min, departure_delay_min
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReliability = db.prepare(`
    INSERT INTO reliability_scores (
      train_number, computed_at, score, punctuality, consistency, cancellations, severe_delays,
      best_month_label, best_month_score, worst_month_label, worst_month_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertInsight = db.prepare(`
    INSERT INTO ai_insights (train_number, run_date, text, generated_at, confidence) VALUES (?, ?, ?, ?, ?)
  `);

  const today = todayISO();

  for (const full of FULL_TRAINS) {
    for (const s of full.route) {
      insertRouteStation.run(
        s.trainNumber, s.sequenceNumber, s.stationCode, s.distanceFromSourceKm,
        s.scheduledArrivalOffsetMin, s.scheduledDepartureOffsetMin, s.haltMinutes, s.platformNumber
      );
    }

    // For monthly reliability breakdown.
    const monthlyDelays = new Map<string, number[]>();
    const allArrivalDelays: number[] = [];
    let cancelledCount = 0;
    let totalRuns = 0;

    // Today's run: built from the fixed "live" config (status = running).
    const liveRun = buildRun(
      full.route,
      full.meta.totalDistanceKm ?? 0,
      full.liveRun.arrivalDelays,
      full.liveRun.departureDelays,
      "running"
    );
    const todayRunId = insertRun.run(
      full.meta.trainNumber, today, "running", "high",
      liveRun.finalDelayMin, liveRun.avgSpeedKmph,
      full.liveRun.currentIndex, full.liveRun.predictedFromIndex,
      full.liveRun.positionDistanceKm, full.liveRun.positionSpeedKmph, full.liveRun.source
    ).lastInsertRowid;
    for (const e of liveRun.events) {
      insertEvent.run(
        todayRunId, e.sequenceNumber, e.stationCode, e.scheduledArrivalOffsetMin, e.scheduledDepartureOffsetMin,
        e.actualArrivalOffsetMin, e.actualDepartureOffsetMin, e.arrivalDelayMin, e.departureDelayMin
      );
    }

    // Historical runs: HISTORY_DAYS days before today, deterministic per date.
    for (let n = 1; n <= HISTORY_DAYS; n++) {
      const dateStr = dateNDaysAgo(n);
      totalRuns++;

      const cancelRng = mulberry32(hashStr(`${full.meta.trainNumber}-${dateStr}-cancel`));
      if (cancelRng() < 0.02) {
        cancelledCount++;
        insertRun.run(full.meta.trainNumber, dateStr, "cancelled", "medium", null, null, null, null, null, null, null);
        continue;
      }

      const run = generateHistoricalRun(full.meta, full.route, dateStr);
      const runId = insertRun.run(
        full.meta.trainNumber, dateStr, "completed", "medium",
        run.finalDelayMin, run.avgSpeedKmph, null, null, null, null, null
      ).lastInsertRowid;

      for (const e of run.events) {
        insertEvent.run(
          runId, e.sequenceNumber, e.stationCode, e.scheduledArrivalOffsetMin, e.scheduledDepartureOffsetMin,
          e.actualArrivalOffsetMin, e.actualDepartureOffsetMin, e.arrivalDelayMin, e.departureDelayMin
        );
        if (e.sequenceNumber > 1 && e.arrivalDelayMin != null) {
          allArrivalDelays.push(e.arrivalDelayMin);
          const month = dateStr.slice(0, 7);
          if (!monthlyDelays.has(month)) monthlyDelays.set(month, []);
          monthlyDelays.get(month)!.push(e.arrivalDelayMin);
        }
      }
    }

    // Reliability score (formula from docs §4.4.1).
    const avgDelay = mean(allArrivalDelays);
    const sd = stddev(allArrivalDelays);
    const cancellationRate = cancelledCount / totalRuns;
    const severeDelayRate = allArrivalDelays.filter((d) => d > 30).length / allArrivalDelays.length;

    const punctuality = Math.min(40, avgDelay * 1.2);
    const consistency = Math.min(30, sd * 1.5);
    const cancellations = Math.min(20, cancellationRate * 100 * 2);
    const severeDelays = Math.min(10, severeDelayRate * 100);
    const score = Math.max(0, Math.min(100, Math.round(100 - punctuality - consistency - cancellations - severeDelays)));

    let bestMonth: { label: string; score: number } | null = null;
    let worstMonth: { label: string; score: number } | null = null;
    for (const [month, delays] of monthlyDelays) {
      const monthAvg = mean(delays);
      const monthScore = Math.max(0, Math.min(100, Math.round(100 - Math.min(40, monthAvg * 1.2))));
      if (!bestMonth || monthScore > bestMonth.score) bestMonth = { label: monthLabel(month), score: monthScore };
      if (!worstMonth || monthScore < worstMonth.score) worstMonth = { label: monthLabel(month), score: monthScore };
    }

    insertReliability.run(
      full.meta.trainNumber, new Date().toISOString(), score,
      Math.round(punctuality * 10) / 10, Math.round(consistency * 10) / 10,
      Math.round(cancellations * 10) / 10, Math.round(severeDelays * 10) / 10,
      bestMonth?.label ?? null, bestMonth?.score ?? null,
      worstMonth?.label ?? null, worstMonth?.score ?? null
    );

    // AI insight for today's run (template, mirrors web/src/lib/derive.ts).
    const recordedArr = liveRun.events
      .map((e, i) => ({ d: e.arrivalDelayMin, i }))
      .filter((x): x is { d: number; i: number } => x.d != null);
    const peak = recordedArr.length ? recordedArr.reduce((max, x) => (x.d > max.d ? x : max)) : { d: 0, i: 0 };
    const currentDelay =
      liveRun.events[full.liveRun.currentIndex]?.departureDelayMin ??
      liveRun.events[full.liveRun.currentIndex]?.arrivalDelayMin ??
      0;
    const recovered = peak.d - currentDelay;
    const destination = full.route[full.route.length - 1];
    const peakStation = full.route[peak.i];

    let text: string;
    if (recovered > 0) {
      text = `${full.meta.name} (${full.meta.trainNumber}) has recovered ${recovered} minutes since ${peakStation.stationName} and is expected to reach ${destination.stationName} only ${Math.max(0, currentDelay - 5)} minutes late.`;
    } else if (currentDelay <= 0) {
      text = `${full.meta.name} (${full.meta.trainNumber}) is running on time.`;
    } else {
      const currentStation = full.route[full.liveRun.currentIndex];
      text = `${full.meta.name} (${full.meta.trainNumber}) is currently running ${currentDelay} minutes late, primarily due to congestion near ${currentStation.stationName}.`;
    }

    insertInsight.run(full.meta.trainNumber, today, text, new Date().toISOString(), 0.82);
  }

  console.log(`Seeded ${DB_PATH}`);
  console.log(`  ${STATIONS.length} stations, ${TRAIN_SUMMARIES.length} trains (${FULL_TRAINS.length} with full data)`);
  console.log(`  ${HISTORY_DAYS} days of history per full-data train`);
}

main();
