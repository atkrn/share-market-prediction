import { delayInfo, headingAtDistance, positionFromDistance } from "@/lib/format";
import type {
  DataFreshness,
  Insight,
  LiveStatus,
  PredictionSet,
  StationEvent,
  StationEventStatus,
  TrainMeta,
} from "@/lib/types";

const BAND_TO_STATUS: Record<string, StationEventStatus> = {
  early: "early",
  ontime: "on_time",
  delayed: "delayed",
  pending: "pending",
};

/** Build the today's-run station-by-station table (Live + Schedule tabs)
 * from a train's static route + live run config. */
export function getLiveSchedule(train: TrainMeta): StationEvent[] {
  const { route, liveRun } = train;
  return route.map((s, i) => {
    const isCurrent = i === liveRun.currentIndex;
    const isPending = i >= liveRun.predictedFromIndex;
    const arrDelay = liveRun.arrivalDelays[i];
    const depDelay = liveRun.departureDelays[i];
    const arrInfo = delayInfo(arrDelay, isPending && arrDelay == null);
    return {
      sequenceNumber: s.sequenceNumber,
      stationCode: s.code,
      stationName: s.name,
      platform: s.platform,
      scheduledArrivalOffsetMin: s.scheduledArrivalOffsetMin,
      scheduledDepartureOffsetMin: s.scheduledDepartureOffsetMin,
      actualArrivalOffsetMin:
        i === 0 || arrDelay == null ? null : (s.scheduledArrivalOffsetMin ?? 0) + arrDelay,
      actualDepartureOffsetMin:
        s.scheduledDepartureOffsetMin == null || depDelay == null
          ? null
          : s.scheduledDepartureOffsetMin + depDelay,
      arrivalDelayMin: arrDelay,
      departureDelayMin: depDelay,
      status: BAND_TO_STATUS[arrInfo.band],
      isCurrent,
      isPending,
    };
  });
}

/** Derive the "live position" view (map marker, status badge, ETA) from
 * the train's static route + live run config. */
export function getLiveStatus(train: TrainMeta): LiveStatus {
  const { route, liveRun } = train;
  const current = route[liveRun.currentIndex];
  const next = route[liveRun.currentIndex + 1] ?? null;

  const pos = positionFromDistance(route, liveRun.position.distanceKm);
  const heading = headingAtDistance(route, liveRun.position.distanceKm);

  // "current delay" = last known departure delay (falls back to arrival delay)
  const currentDelay =
    liveRun.departureDelays[liveRun.currentIndex] ??
    liveRun.arrivalDelays[liveRun.currentIndex] ??
    0;

  const recordedArr = liveRun.arrivalDelays.filter((d): d is number => d != null);
  const allRecorded = [
    ...recordedArr,
    ...liveRun.departureDelays.filter((d): d is number => d != null),
  ];
  const maxToday = allRecorded.length ? Math.max(...allRecorded) : 0;
  const avgDelay = recordedArr.length
    ? recordedArr.reduce((a, b) => a + b, 0) / recordedArr.length
    : 0;

  // Trend: compare the two most recent recorded arrival delays.
  let trend: LiveStatus["delay"]["trend"] = "stable";
  if (recordedArr.length >= 2) {
    const last = recordedArr[recordedArr.length - 1];
    const prev = recordedArr[recordedArr.length - 2];
    if (last < prev) trend = "recovering";
    else if (last > prev) trend = "worsening";
  }

  const nextPredictedDelay = next
    ? liveRun.arrivalDelays[liveRun.currentIndex + 1] ?? currentDelay
    : null;

  const dataFreshness: DataFreshness = {
    lastUpdated: new Date().toISOString(),
    source: liveRun.source,
    stalenessSeconds: 38,
  };

  return {
    trainNumber: train.trainNumber,
    name: train.name,
    runDate: new Date().toISOString().slice(0, 10),
    status: liveRun.status,
    currentStation: current ? { code: current.code, name: current.name } : null,
    nextStation: next
      ? {
          code: next.code,
          name: next.name,
          scheduledArrivalOffsetMin: next.scheduledArrivalOffsetMin,
          predictedDelayMin: nextPredictedDelay,
        }
      : null,
    position: {
      lat: pos.lat,
      lon: pos.lon,
      speedKmph: liveRun.position.speedKmph,
      headingDeg: heading,
      distanceCoveredKm: liveRun.position.distanceKm,
      distanceRemainingKm: Math.max(0, train.totalDistanceKm - liveRun.position.distanceKm),
    },
    delay: {
      currentMinutes: currentDelay,
      maxTodayMinutes: maxToday,
      averageMinutes: Math.round(avgDelay * 10) / 10,
      trend,
    },
    dataFreshness,
  };
}

/** Predicted ETA for the next station and destination, derived from the
 * "current delay carries forward, recovering slightly" heuristic — a
 * stand-in for the XGBoost model in docs/rail-intelligence-platform/15-ai-features.md. */
export function getPredictions(train: TrainMeta): PredictionSet {
  const { route, liveRun } = train;
  const current = liveRun.currentIndex;
  const currentDelay = liveRun.departureDelays[current] ?? liveRun.arrivalDelays[current] ?? 0;

  const nextIdx = Math.min(current + 1, route.length - 1);
  const next = route[nextIdx];
  const destination = route[route.length - 1];

  const predictedNextDelay = Math.max(0, currentDelay - 1);
  const predictedFinalDelay = Math.max(0, currentDelay - 5);

  return {
    trainNumber: train.trainNumber,
    nextStation: {
      stationCode: next.code,
      predictedArrivalOffsetMin: (next.scheduledArrivalOffsetMin ?? 0) + predictedNextDelay,
      predictedDelayMinutes: predictedNextDelay,
      confidence: 0.85,
    },
    destination: {
      stationCode: destination.code,
      predictedArrivalOffsetMin: (destination.scheduledArrivalOffsetMin ?? 0) + predictedFinalDelay,
      predictedDelayMinutes: predictedFinalDelay,
      confidence: 0.74,
    },
    furtherDelayProbability: 0.18,
    modelVersion: "xgboost-eta-v0.3.1",
  };
}

/** Template-tier AI insight (see docs/rail-intelligence-platform/15-ai-features.md §15.6). */
export function getInsights(train: TrainMeta): Insight[] {
  const { liveRun, route } = train;
  const current = liveRun.currentIndex;
  const recordedArr = liveRun.arrivalDelays
    .map((d, i) => ({ d, i }))
    .filter((x): x is { d: number; i: number } => x.d != null);

  const peak = recordedArr.length
    ? recordedArr.reduce((max, x) => (x.d > max.d ? x : max))
    : { d: 0, i: 0 };
  const currentDelay = liveRun.departureDelays[current] ?? liveRun.arrivalDelays[current] ?? 0;
  const recovered = peak.d - currentDelay;
  const destination = route[route.length - 1];

  let text: string;
  if (recovered > 0) {
    text = `${train.name} (${train.trainNumber}) has recovered ${recovered} minutes since ${route[peak.i].name} and is expected to reach ${destination.name} only ${Math.max(0, currentDelay - 5)} minutes late.`;
  } else if (currentDelay <= 0) {
    text = `${train.name} (${train.trainNumber}) is running on time.`;
  } else {
    text = `${train.name} (${train.trainNumber}) is currently running ${currentDelay} minutes late, primarily due to congestion near ${route[current].name}.`;
  }

  return [
    {
      runDate: new Date().toISOString().slice(0, 10),
      text,
      generatedAt: new Date().toISOString(),
      confidence: 0.82,
    },
  ];
}
