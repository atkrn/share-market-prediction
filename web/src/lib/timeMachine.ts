import { lerp } from "@/lib/format";
import type { CurvePoint, Run, RunStation, RunSummary, TrainMeta } from "@/lib/types";

/** Deterministic PRNG (mulberry32) so replays are stable across renders
 * and identical between server and client for a given seed. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

/** Days-ago offsets used to synthesize the Time Machine date picker's
 * "available dates" list — index 0 is always "today" (the live run). */
const AVAILABLE_DATE_OFFSETS = [0, 1, 20, 90, 147, 167];

export function getAvailableDates(referenceDate: Date = new Date()): string[] {
  return AVAILABLE_DATE_OFFSETS.map((offset) => {
    const d = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
    );
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  });
}

export function buildTimeDistanceCurve(stations: RunStation[]): CurvePoint[] {
  const points: CurvePoint[] = [];
  stations.forEach((s, i) => {
    if (i === 0) {
      points.push({ t: 0, d: 0 });
      if (s.actualDepartureMin != null) points.push({ t: s.actualDepartureMin, d: 0 });
      return;
    }
    points.push({ t: s.actualArrivalMin as number, d: s.distanceFromSourceKm });
    if (s.actualDepartureMin != null) {
      points.push({ t: s.actualDepartureMin, d: s.distanceFromSourceKm });
    }
  });
  return points;
}

export function distanceAtTime(curve: CurvePoint[], t: number): number {
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (t >= a.t && t <= b.t) {
      if (b.t === a.t) return a.d;
      const f = (t - a.t) / (b.t - a.t);
      return lerp(a.d, b.d, f);
    }
  }
  return curve[curve.length - 1].d;
}

export function buildRun(
  train: TrainMeta,
  arrDelays: (number | null)[],
  depDelays: (number | null)[],
  status: Run["status"],
  date: string
): Run {
  const stations: RunStation[] = train.route.map((s, i) => ({
    ...s,
    actualArrivalMin:
      i === 0 ? null : (s.scheduledArrivalOffsetMin ?? 0) + (arrDelays[i] ?? 0),
    actualDepartureMin:
      s.scheduledDepartureOffsetMin == null
        ? null
        : s.scheduledDepartureOffsetMin + (depDelays[i] ?? 0),
    arrivalDelayMin: i === 0 ? null : arrDelays[i],
    departureDelayMin: s.scheduledDepartureOffsetMin == null ? null : depDelays[i],
  }));

  const totalDurationMin = stations[stations.length - 1].actualArrivalMin as number;
  const allDelays = [...arrDelays, ...depDelays].filter((d): d is number => d != null);
  const maxDelayMin = allDelays.length ? Math.max(...allDelays) : 0;
  const finalDelayMin = arrDelays[arrDelays.length - 1] ?? 0;
  const avgSpeedKmph = Number((train.totalDistanceKm / (totalDurationMin / 60)).toFixed(1));

  return {
    date,
    status,
    stations,
    totalDurationMin,
    maxDelayMin,
    finalDelayMin,
    avgSpeedKmph,
    curve: buildTimeDistanceCurve(stations),
  };
}

/**
 * Generate (or reconstruct) a historical run for `dateStr`.
 * - `todayStr` reuses the train's live run config (treating any
 *   not-yet-recorded stations as completed, for replay purposes).
 * - Other dates use a per-train-per-date seeded PRNG so the same date
 *   always reproduces the same run.
 */
export function generateRunData(train: TrainMeta, dateStr: string, todayStr: string): Run {
  if (dateStr === todayStr) {
    const live = train.liveRun;
    const arr = live.arrivalDelays.map((d) => d ?? 0);
    const dep = live.departureDelays.map((d) => d ?? 0);
    const status = live.status === "running" ? "running" : live.status;
    return buildRun(train, arr, dep, status, dateStr);
  }

  const rng = mulberry32(hashStr(`${train.trainNumber}-${dateStr}`));
  let delay = Math.floor(rng() * 10);
  const arr: (number | null)[] = [];
  const dep: (number | null)[] = [];
  train.route.forEach((s, i) => {
    if (i === 0) {
      arr.push(0);
      dep.push(0);
      return;
    }
    delay += Math.floor((rng() - 0.45) * 16);
    delay = Math.max(0, Math.min(45, delay));
    arr.push(delay);
    const dDelay = Math.max(0, delay + Math.floor((rng() - 0.5) * 4));
    dep.push(s.scheduledDepartureOffsetMin == null ? null : dDelay);
  });
  return buildRun(train, arr, dep, "completed", dateStr);
}

export function getRunSummaries(train: TrainMeta, dates: string[], todayStr: string): RunSummary[] {
  return dates.map((date) => {
    const run = generateRunData(train, date, todayStr);
    return {
      runDate: date,
      status: run.status,
      finalDelayMinutes: run.finalDelayMin,
      averageSpeedKmph: run.avgSpeedKmph,
      dataQuality: date === todayStr ? "high" : "medium",
    };
  });
}
