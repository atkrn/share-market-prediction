import { mulberry32, hashStr } from "./rng.js";
import type { GeneratedRun, GeneratedStationEvent, RouteStationRow, TrainRow } from "../types.js";

/** Build a run's station events from per-station arrival/departure delay
 * arrays (index-aligned with `route`). Mirrors `buildRun` in
 * web/src/lib/timeMachine.ts. */
export function buildRun(
  route: RouteStationRow[],
  totalDistanceKm: number,
  arrDelays: (number | null)[],
  depDelays: (number | null)[],
  status: "running" | "completed"
): GeneratedRun {
  const events: GeneratedStationEvent[] = route.map((s, i) => {
    const arrDelay = i === 0 ? null : arrDelays[i] ?? null;
    const depDelay = s.scheduledDepartureOffsetMin == null ? null : depDelays[i] ?? null;
    return {
      sequenceNumber: s.sequenceNumber,
      stationCode: s.stationCode,
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
    };
  });

  const last = events[events.length - 1];
  const totalDurationMin = last.actualArrivalOffsetMin ?? last.scheduledArrivalOffsetMin ?? 0;
  const allDelays = [...arrDelays, ...depDelays].filter((d): d is number => d != null);
  const maxDelayMin = allDelays.length ? Math.max(...allDelays) : 0;
  const finalDelayMin = arrDelays[arrDelays.length - 1] ?? 0;
  const avgSpeedKmph = totalDurationMin > 0 ? Number((totalDistanceKm / (totalDurationMin / 60)).toFixed(1)) : 0;

  return { status, events, totalDurationMin, maxDelayMin, finalDelayMin, avgSpeedKmph };
}

/** Generate a deterministic synthetic historical run for `dateStr`,
 * seeded from `${trainNumber}-${dateStr}` — ported from
 * `generateRunData`'s "other dates" branch in web/src/lib/timeMachine.ts
 * so the same date always reproduces the same run. */
export function generateHistoricalRun(
  train: TrainRow,
  route: RouteStationRow[],
  dateStr: string
): GeneratedRun {
  const rng = mulberry32(hashStr(`${train.trainNumber}-${dateStr}`));
  let delay = Math.floor(rng() * 10);
  const arr: (number | null)[] = [];
  const dep: (number | null)[] = [];
  route.forEach((s, i) => {
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
  return buildRun(route, train.totalDistanceKm ?? 0, arr, dep, "completed");
}
