// Types mirror api/openapi.yaml component schemas, with additional
// internal fields (lat/lon, offsets in minutes) needed for the map &
// Time Machine playback engine.

export type TrainType =
  | "rajdhani"
  | "shatabdi"
  | "duronto"
  | "express"
  | "passenger"
  | "superfast";

export type RunStatus =
  | "scheduled"
  | "running"
  | "completed"
  | "cancelled"
  | "terminated_early";

export type DataQuality = "high" | "medium" | "low" | "interpolated";

export type DelaySource =
  | "crowd_gps"
  | "ntes_scrape"
  | "official_feed"
  | "interpolated";

export interface TrainSummary {
  trainNumber: string;
  name: string;
  nameLocal?: string;
  sourceStation: string;
  destinationStation: string;
  trainType: TrainType;
}

/** A station on a train's route, with scheduling offsets (minutes from
 * origin departure) and geo-coordinates for map rendering. */
export interface RouteStop {
  sequenceNumber: number;
  code: string;
  name: string;
  lat: number;
  lon: number;
  distanceFromSourceKm: number;
  /** minutes from origin departure; null only for the origin station's arrival */
  scheduledArrivalOffsetMin: number | null;
  /** minutes from origin departure; null only for the destination station's departure */
  scheduledDepartureOffsetMin: number | null;
  haltMinutes: number;
  platform: string | null;
}

/** Static configuration describing "today's" live run for a train —
 * used to derive LiveStatus / StationEvent[] on the fly. */
export interface LiveRunConfig {
  status: RunStatus;
  /** arrival delay (minutes) per route stop; null = not yet recorded */
  arrivalDelays: (number | null)[];
  /** departure delay (minutes) per route stop; null = not yet recorded */
  departureDelays: (number | null)[];
  /** index from which station data is predicted rather than recorded */
  predictedFromIndex: number;
  /** index of the last station with confirmed actuals */
  currentIndex: number;
  position: { distanceKm: number; speedKmph: number; headingDeg: number };
  source: DelaySource;
}

export interface TrainMeta extends TrainSummary {
  zone: string;
  totalDistanceKm: number;
  averageSpeedKmph: number;
  runsOnDays: string; // 7-char bitstring, Mon..Sun
  /** wall-clock origin departure time, 24h */
  originDeparture: { hour: number; minute: number };
  scheduledDurationMin: number;
  route: RouteStop[];
  liveRun: LiveRunConfig;
}

export interface DataFreshness {
  lastUpdated: string;
  source: DelaySource;
  stalenessSeconds: number;
}

export interface LiveStatus {
  trainNumber: string;
  name: string;
  runDate: string;
  status: RunStatus;
  currentStation: { code: string; name: string } | null;
  nextStation: {
    code: string;
    name: string;
    scheduledArrivalOffsetMin: number | null;
    predictedDelayMin: number | null;
  } | null;
  position: {
    lat: number;
    lon: number;
    speedKmph: number;
    headingDeg: number;
    distanceCoveredKm: number;
    distanceRemainingKm: number;
  };
  delay: {
    currentMinutes: number;
    maxTodayMinutes: number;
    averageMinutes: number;
    trend: "recovering" | "worsening" | "stable";
  };
  dataFreshness: DataFreshness;
}

export type StationEventStatus = "early" | "on_time" | "delayed" | "pending";

export interface StationEvent {
  sequenceNumber: number;
  stationCode: string;
  stationName: string;
  platform: string | null;
  scheduledArrivalOffsetMin: number | null;
  scheduledDepartureOffsetMin: number | null;
  actualArrivalOffsetMin: number | null;
  actualDepartureOffsetMin: number | null;
  arrivalDelayMin: number | null;
  departureDelayMin: number | null;
  status: StationEventStatus;
  isCurrent: boolean;
  isPending: boolean;
}

export interface RunSummary {
  runDate: string;
  status: RunStatus;
  finalDelayMinutes: number | null;
  averageSpeedKmph: number | null;
  dataQuality: DataQuality;
}

export interface RunStation extends RouteStop {
  actualArrivalMin: number | null;
  actualDepartureMin: number | null;
  arrivalDelayMin: number | null;
  departureDelayMin: number | null;
}

export interface CurvePoint {
  /** minutes from origin departure */
  t: number;
  /** km from origin */
  d: number;
}

export interface Run {
  date: string;
  status: RunStatus;
  stations: RunStation[];
  totalDurationMin: number;
  maxDelayMin: number;
  finalDelayMin: number;
  avgSpeedKmph: number;
  curve: CurvePoint[];
}

export interface ReplayPayload {
  trainNumber: string;
  runDate: string;
  run: Run;
}

export interface Insight {
  runDate: string;
  text: string;
  textLocal?: string;
  generatedAt: string;
  confidence: number;
}

export interface ReliabilityComponents {
  punctuality: number;
  consistency: number;
  cancellations: number;
  severeDelays: number;
}

export interface ReliabilityScore {
  trainNumber: string;
  score: number;
  computedAt: string;
  components: ReliabilityComponents;
  bestMonth: { label: string; score: number };
  worstMonth: { label: string; score: number };
}

export interface StationDelayStat {
  stationCode: string;
  stationName: string;
  avgMinutes: number;
}

export interface AnalyticsSummary {
  trainNumber: string;
  window: string;
  averageDelayMinutes: number;
  maxDelayMinutes: number;
  punctualityPct: number;
  averageSpeedKmph: number;
  mostDelayedStations: StationDelayStat[];
  recoveryStations: StationDelayStat[];
  delayTrend: number[]; // last N days, oldest first
  dayOfWeekAvgDelay: number[]; // Mon..Sun
}

export interface PredictionLeg {
  stationCode: string;
  predictedDelayMinutes: number;
  confidence: number;
}

export interface PredictionSet {
  trainNumber: string;
  nextStation: PredictionLeg & { predictedArrivalOffsetMin: number };
  destination: PredictionLeg & { predictedArrivalOffsetMin: number };
  furtherDelayProbability: number;
  modelVersion: string;
}
