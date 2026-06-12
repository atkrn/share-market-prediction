import { buildTimeDistanceCurve } from "@/lib/timeMachine";
import type {
  AnalyticsSummary,
  DataQuality,
  DelaySource,
  Insight,
  LiveStatus,
  PredictionSet,
  ReliabilityScore,
  ReplayPayload,
  Run,
  RunStation,
  RunStatus,
  RunSummary,
  StationEvent,
  StationEventStatus,
  TrainMeta,
  TrainSummary,
  TrainType,
  RouteStop,
} from "@/lib/types";

/**
 * Thin async data-access layer. Every function here mirrors an endpoint in
 * api/openapi.yaml and reads from the RailPulse API server (`server/`,
 * default http://localhost:4000). Backend responses are snake_case; this
 * module converts them to the camelCase shapes UI code expects (lib/types.ts).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

// ---- Backend response shapes (snake_case) ----------------------------------

interface BackendTrainSummary {
  train_number: string;
  name: string;
  name_local: string | null;
  source_station: string;
  destination_station: string;
  train_type: string;
}

interface BackendTrain extends BackendTrainSummary {
  zone: string;
  total_distance_km: number;
  average_speed_kmph: number;
  runs_on_days: string;
  origin_departure_hour: number;
  origin_departure_minute: number;
  scheduled_duration_min: number;
}

interface BackendRouteStop {
  sequence_number: number;
  station_code: string;
  station_name: string;
  lat: number;
  lon: number;
  distance_from_source_km: number;
  scheduled_arrival_offset_minutes: number | null;
  scheduled_departure_offset_minutes: number | null;
  halt_minutes: number;
  platform_number: string | null;
}

interface BackendLiveStatus {
  train_number: string;
  name: string;
  run_date: string;
  status: string;
  current_station: { code: string; name: string } | null;
  next_station: {
    code: string;
    name: string;
    scheduled_arrival: string;
    predicted_arrival: string;
    predicted_delay_minutes: number | null;
  } | null;
  position: {
    lat: number;
    lon: number;
    speed_kmph: number;
    heading_degrees: number;
    distance_covered_km: number;
    distance_remaining_km: number;
  };
  delay: {
    current_minutes: number;
    max_today_minutes: number;
    average_minutes: number;
    trend: "recovering" | "worsening" | "stable";
  };
  data_freshness: {
    last_updated: string;
    source: string;
    staleness_seconds: number;
  };
}

interface BackendStationEvent {
  sequence_number: number;
  station_code: string;
  station_name: string;
  scheduled_arrival: string | null;
  actual_arrival: string | null;
  scheduled_departure: string | null;
  actual_departure: string | null;
  arrival_delay_minutes: number | null;
  departure_delay_minutes: number | null;
  status: string;
  is_current: boolean;
  is_pending: boolean;
}

interface BackendRun {
  run_date: string;
  status: string;
  final_delay_minutes: number | null;
  average_speed_kmph: number | null;
  data_quality: string;
}

interface BackendReplay {
  run_date: string;
  status: string;
  station_events: BackendStationEvent[];
  summary: {
    total_duration_minutes: number;
    average_speed_kmph: number;
    final_delay_minutes: number;
    max_delay_minutes: number;
  } | null;
}

interface BackendAnalytics {
  train_number: string;
  window: string;
  average_delay_minutes: number;
  max_delay_minutes: number;
  most_delayed_stations: { station_code: string; station_name: string; average_delay_minutes: number }[];
  recovery_stations: { station_code: string; station_name: string; average_recovery_minutes: number }[];
  day_of_week_performance: { day: string; average_delay_minutes: number }[];
  punctuality_pct: number;
  average_speed_kmph: number | null;
  delay_trend: number[];
}

interface BackendReliability {
  train_number: string;
  score: number;
  computed_at: string;
  components: { punctuality: number; consistency: number; cancellations: number; severe_delays: number };
  best_month: { label: string; score: number } | null;
  worst_month: { label: string; score: number } | null;
}

interface BackendPredictionSet {
  train_number: string;
  run_date: string;
  next_station: { station_code: string; predicted_arrival: string; predicted_delay_minutes: number; confidence: number };
  destination: { station_code: string; predicted_arrival: string; predicted_delay_minutes: number; confidence: number };
  further_delay_probability: number;
  model_version: string;
}

interface BackendInsight {
  run_date: string;
  text: string;
  generated_at: string;
  confidence: number;
}

// ---- Helpers -----------------------------------------------------------------

/** GET `${API_BASE_URL}${path}`. Returns `null` for 404 (the documented
 * "not found" case), throws on other non-OK responses or network errors. */
async function apiGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`RailPulse API ${path} returned ${res.status}`);
  return (await res.json()) as T;
}

/** Inverse of the server's `offsetToISO`: convert an absolute timestamp back
 * into minutes-from-origin-departure for `runDate`. */
function isoToOffsetMin(iso: string, runDate: string, origin: { hour: number; minute: number }): number {
  const base = new Date(`${runDate}T00:00:00.000Z`);
  base.setUTCMinutes(origin.hour * 60 + origin.minute);
  return Math.round((new Date(iso).getTime() - base.getTime()) / 60000);
}

function toTrainSummary(t: BackendTrainSummary): TrainSummary {
  return {
    trainNumber: t.train_number,
    name: t.name,
    nameLocal: t.name_local ?? undefined,
    sourceStation: t.source_station,
    destinationStation: t.destination_station,
    trainType: t.train_type as TrainType,
  };
}

function toRouteStop(s: BackendRouteStop): RouteStop {
  return {
    sequenceNumber: s.sequence_number,
    code: s.station_code,
    name: s.station_name,
    lat: s.lat,
    lon: s.lon,
    distanceFromSourceKm: s.distance_from_source_km,
    scheduledArrivalOffsetMin: s.scheduled_arrival_offset_minutes,
    scheduledDepartureOffsetMin: s.scheduled_departure_offset_minutes,
    haltMinutes: s.halt_minutes,
    platform: s.platform_number,
  };
}

// ---- Public API ----------------------------------------------------------------

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function searchTrains(query: string, limit = 10): Promise<TrainSummary[]> {
  const results = await apiGet<BackendTrainSummary[]>(`/trains/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  return (results ?? []).map(toTrainSummary);
}

export async function getTrainSummary(trainNumber: string): Promise<TrainSummary | null> {
  const results = await searchTrains(trainNumber, 10);
  return results.find((t) => t.trainNumber === trainNumber) ?? null;
}

export async function getTrain(trainNumber: string): Promise<TrainMeta | null> {
  const meta = await apiGet<BackendTrain>(`/trains/${trainNumber}`);
  if (!meta) return null;

  const [route, live, schedule] = await Promise.all([
    apiGet<BackendRouteStop[]>(`/trains/${trainNumber}/route`),
    apiGet<BackendLiveStatus>(`/trains/${trainNumber}/live`),
    apiGet<BackendStationEvent[]>(`/trains/${trainNumber}/live/schedule`),
  ]);

  const currentIndex = schedule?.findIndex((e) => e.is_current) ?? 0;
  const firstPending = schedule?.findIndex((e) => e.is_pending) ?? -1;
  const predictedFromIndex = firstPending === -1 ? (schedule?.length ?? 0) : firstPending;

  return {
    ...toTrainSummary(meta),
    zone: meta.zone,
    totalDistanceKm: meta.total_distance_km,
    averageSpeedKmph: meta.average_speed_kmph,
    runsOnDays: meta.runs_on_days,
    originDeparture: { hour: meta.origin_departure_hour, minute: meta.origin_departure_minute },
    scheduledDurationMin: meta.scheduled_duration_min,
    route: (route ?? []).map(toRouteStop),
    liveRun: {
      status: (live?.status ?? "scheduled") as RunStatus,
      arrivalDelays: schedule?.map((e) => e.arrival_delay_minutes) ?? [],
      departureDelays: schedule?.map((e) => e.departure_delay_minutes) ?? [],
      predictedFromIndex: Math.max(0, predictedFromIndex),
      currentIndex: Math.max(0, currentIndex),
      position: {
        distanceKm: live?.position.distance_covered_km ?? 0,
        speedKmph: live?.position.speed_kmph ?? 0,
        headingDeg: live?.position.heading_degrees ?? 0,
      },
      source: (live?.data_freshness.source ?? "interpolated") as DelaySource,
    },
  };
}

export async function getLiveStatus(trainNumber: string): Promise<LiveStatus | null> {
  const [live, meta] = await Promise.all([
    apiGet<BackendLiveStatus>(`/trains/${trainNumber}/live`),
    apiGet<BackendTrain>(`/trains/${trainNumber}`),
  ]);
  if (!live || !meta) return null;
  const origin = { hour: meta.origin_departure_hour, minute: meta.origin_departure_minute };

  return {
    trainNumber: live.train_number,
    name: live.name,
    runDate: live.run_date,
    status: live.status as RunStatus,
    currentStation: live.current_station,
    nextStation: live.next_station
      ? {
          code: live.next_station.code,
          name: live.next_station.name,
          scheduledArrivalOffsetMin: isoToOffsetMin(live.next_station.scheduled_arrival, live.run_date, origin),
          predictedDelayMin: live.next_station.predicted_delay_minutes,
        }
      : null,
    position: {
      lat: live.position.lat,
      lon: live.position.lon,
      speedKmph: live.position.speed_kmph,
      headingDeg: live.position.heading_degrees,
      distanceCoveredKm: live.position.distance_covered_km,
      distanceRemainingKm: live.position.distance_remaining_km,
    },
    delay: {
      currentMinutes: live.delay.current_minutes,
      maxTodayMinutes: live.delay.max_today_minutes,
      averageMinutes: live.delay.average_minutes,
      trend: live.delay.trend,
    },
    dataFreshness: {
      lastUpdated: live.data_freshness.last_updated,
      source: live.data_freshness.source as DelaySource,
      stalenessSeconds: live.data_freshness.staleness_seconds,
    },
  };
}

export async function getLiveSchedule(trainNumber: string): Promise<StationEvent[]> {
  const [schedule, route, live, meta] = await Promise.all([
    apiGet<BackendStationEvent[]>(`/trains/${trainNumber}/live/schedule`),
    apiGet<BackendRouteStop[]>(`/trains/${trainNumber}/route`),
    apiGet<BackendLiveStatus>(`/trains/${trainNumber}/live`),
    apiGet<BackendTrain>(`/trains/${trainNumber}`),
  ]);
  if (!schedule || !live || !meta) return [];
  const origin = { hour: meta.origin_departure_hour, minute: meta.origin_departure_minute };
  const platformByCode = new Map((route ?? []).map((s) => [s.station_code, s.platform_number]));

  return schedule.map((e, i) => ({
    sequenceNumber: e.sequence_number,
    stationCode: e.station_code,
    stationName: e.station_name,
    platform: platformByCode.get(e.station_code) ?? null,
    scheduledArrivalOffsetMin: route?.[i]?.scheduled_arrival_offset_minutes ?? null,
    scheduledDepartureOffsetMin: route?.[i]?.scheduled_departure_offset_minutes ?? null,
    actualArrivalOffsetMin: e.actual_arrival == null ? null : isoToOffsetMin(e.actual_arrival, live.run_date, origin),
    actualDepartureOffsetMin: e.actual_departure == null ? null : isoToOffsetMin(e.actual_departure, live.run_date, origin),
    arrivalDelayMin: e.arrival_delay_minutes,
    departureDelayMin: e.departure_delay_minutes,
    status: e.status as StationEventStatus,
    isCurrent: e.is_current,
    isPending: e.is_pending,
  }));
}

export async function getInsights(trainNumber: string): Promise<Insight[]> {
  const insights = await apiGet<BackendInsight[]>(`/trains/${trainNumber}/insights`);
  return (insights ?? []).map((i) => ({
    runDate: i.run_date,
    text: i.text,
    generatedAt: i.generated_at,
    confidence: i.confidence,
  }));
}

export async function getPredictions(trainNumber: string): Promise<PredictionSet | null> {
  const [predictions, meta] = await Promise.all([
    apiGet<BackendPredictionSet>(`/trains/${trainNumber}/predictions`),
    apiGet<BackendTrain>(`/trains/${trainNumber}`),
  ]);
  if (!predictions || !meta) return null;
  const origin = { hour: meta.origin_departure_hour, minute: meta.origin_departure_minute };

  return {
    trainNumber: predictions.train_number,
    nextStation: {
      stationCode: predictions.next_station.station_code,
      predictedArrivalOffsetMin: isoToOffsetMin(predictions.next_station.predicted_arrival, predictions.run_date, origin),
      predictedDelayMinutes: predictions.next_station.predicted_delay_minutes,
      confidence: predictions.next_station.confidence,
    },
    destination: {
      stationCode: predictions.destination.station_code,
      predictedArrivalOffsetMin: isoToOffsetMin(predictions.destination.predicted_arrival, predictions.run_date, origin),
      predictedDelayMinutes: predictions.destination.predicted_delay_minutes,
      confidence: predictions.destination.confidence,
    },
    furtherDelayProbability: predictions.further_delay_probability,
    modelVersion: predictions.model_version,
  };
}

export async function getAvailableDates(trainNumber: string): Promise<string[]> {
  const runs = await apiGet<BackendRun[]>(`/trains/${trainNumber}/runs`);
  // Most-recent-first; index 0 ("today") matches the Time Machine's
  // `todayStr` convention.
  return (runs ?? []).map((r) => r.run_date);
}

export async function getRuns(trainNumber: string): Promise<RunSummary[]> {
  const runs = await apiGet<BackendRun[]>(`/trains/${trainNumber}/runs`);
  return (runs ?? []).map((r) => ({
    runDate: r.run_date,
    status: r.status as RunStatus,
    finalDelayMinutes: r.final_delay_minutes,
    averageSpeedKmph: r.average_speed_kmph,
    dataQuality: r.data_quality as DataQuality,
  }));
}

export async function getReplay(trainNumber: string, date: string): Promise<ReplayPayload | null> {
  const [meta, route, replay] = await Promise.all([
    apiGet<BackendTrain>(`/trains/${trainNumber}`),
    apiGet<BackendRouteStop[]>(`/trains/${trainNumber}/route`),
    apiGet<BackendReplay>(`/trains/${trainNumber}/runs/${date}/replay`),
  ]);
  if (!meta || !route || !replay) return null;
  const origin = { hour: meta.origin_departure_hour, minute: meta.origin_departure_minute };
  const routeStops = route.map(toRouteStop);

  const stations: RunStation[] = routeStops.map((stop, i) => {
    const event = replay.station_events[i];
    if (!event) {
      return { ...stop, actualArrivalMin: null, actualDepartureMin: null, arrivalDelayMin: null, departureDelayMin: null };
    }
    // Stations not yet reached on an in-progress run report a null
    // `actual_*` timestamp; fall back to the scheduled time (treating the
    // not-yet-recorded delay as zero) so the replay curve has no gaps.
    const actualArrival = event.actual_arrival ?? event.scheduled_arrival;
    const actualDeparture = event.actual_departure ?? event.scheduled_departure;
    return {
      ...stop,
      actualArrivalMin: actualArrival == null ? null : isoToOffsetMin(actualArrival, date, origin),
      actualDepartureMin: actualDeparture == null ? null : isoToOffsetMin(actualDeparture, date, origin),
      arrivalDelayMin: event.arrival_delay_minutes,
      departureDelayMin: event.departure_delay_minutes,
    };
  });

  const run: Run = {
    date: replay.run_date,
    status: replay.status as RunStatus,
    stations,
    totalDurationMin: replay.summary?.total_duration_minutes ?? 0,
    maxDelayMin: replay.summary?.max_delay_minutes ?? 0,
    finalDelayMin: replay.summary?.final_delay_minutes ?? 0,
    avgSpeedKmph: replay.summary?.average_speed_kmph ?? 0,
    curve: replay.summary ? buildTimeDistanceCurve(stations) : [{ t: 0, d: 0 }],
  };

  return { trainNumber, runDate: date, run };
}

export async function getAnalytics(trainNumber: string, window = "30d"): Promise<AnalyticsSummary | null> {
  const analytics = await apiGet<BackendAnalytics>(`/trains/${trainNumber}/analytics?window=${window}`);
  if (!analytics) return null;

  return {
    trainNumber: analytics.train_number,
    window: analytics.window,
    averageDelayMinutes: analytics.average_delay_minutes,
    maxDelayMinutes: analytics.max_delay_minutes,
    punctualityPct: analytics.punctuality_pct,
    averageSpeedKmph: analytics.average_speed_kmph ?? 0,
    mostDelayedStations: analytics.most_delayed_stations.map((s) => ({
      stationCode: s.station_code,
      stationName: s.station_name,
      avgMinutes: s.average_delay_minutes,
    })),
    // The server reports recovery as a positive "minutes recovered"; the
    // UI's StationDelayStat convention shows recovery as negative.
    recoveryStations: analytics.recovery_stations.map((s) => ({
      stationCode: s.station_code,
      stationName: s.station_name,
      avgMinutes: -s.average_recovery_minutes,
    })),
    delayTrend: analytics.delay_trend,
    dayOfWeekAvgDelay: analytics.day_of_week_performance.map((d) => d.average_delay_minutes),
  };
}

export async function getReliability(trainNumber: string): Promise<ReliabilityScore | null> {
  const reliability = await apiGet<BackendReliability>(`/trains/${trainNumber}/reliability`);
  if (!reliability) return null;

  return {
    trainNumber: reliability.train_number,
    score: reliability.score,
    computedAt: reliability.computed_at,
    components: {
      punctuality: reliability.components.punctuality,
      consistency: reliability.components.consistency,
      cancellations: reliability.components.cancellations,
      severeDelays: reliability.components.severe_delays,
    },
    bestMonth: reliability.best_month ?? { label: "—", score: reliability.score },
    worstMonth: reliability.worst_month ?? { label: "—", score: reliability.score },
  };
}

export async function getPopularTrains(limit = 6): Promise<TrainSummary[]> {
  return searchTrains("", limit);
}
