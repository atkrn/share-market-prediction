import { buildTimeDistanceCurve, distanceAtTime } from "./curve.js";
import type { RouteStationRow, StationEventRow } from "../db/repository.js";

export interface LiveProgress {
  elapsedMin: number;
  currentIndex: number;
  predictedFromIndex: number;
  positionDistanceKm: number;
  positionSpeedKmph: number;
}

/**
 * Simulate "where is the train right now" purely as a function of
 * wall-clock time. The day's full outcome (arrival/departure delay at
 * every station) is already fixed by the seed data — this just picks
 * where on that timeline `now` falls, so `/live` keeps moving every time
 * it's polled. The journey repeats every `totalDurationMin` so the
 * simulation never goes stale.
 */
export function computeLiveProgress(
  route: RouteStationRow[],
  events: StationEventRow[],
  originHour: number,
  originMinute: number,
  now: Date = new Date()
): LiveProgress {
  const last = events[events.length - 1];
  const totalDurationMin = last.actual_arrival_offset_min ?? last.scheduled_arrival_offset_min ?? 1;

  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  const originMin = originHour * 60 + originMinute;
  const elapsedMin = (((nowMin - originMin) % totalDurationMin) + totalDurationMin) % totalDurationMin;

  let currentIndex = 0;
  events.forEach((e, i) => {
    const reachedAt = i === 0 ? 0 : e.actual_arrival_offset_min;
    if (reachedAt != null && reachedAt <= elapsedMin) currentIndex = i;
  });
  const predictedFromIndex = Math.min(currentIndex + 1, events.length);

  const curve = buildTimeDistanceCurve(
    events.map((e, i) => ({
      distanceFromSourceKm: route[i].distance_from_source_km,
      actualArrivalOffsetMin: e.actual_arrival_offset_min,
      actualDepartureOffsetMin: e.actual_departure_offset_min,
    }))
  );
  const positionDistanceKm = Math.round(distanceAtTime(curve, elapsedMin) * 10) / 10;
  const d1 = distanceAtTime(curve, Math.max(0, elapsedMin - 1));
  const d2 = distanceAtTime(curve, Math.min(totalDurationMin, elapsedMin + 1));
  const positionSpeedKmph = Math.max(0, Math.round((d2 - d1) * 30 * 10) / 10);

  return { elapsedMin, currentIndex, predictedFromIndex, positionDistanceKm, positionSpeedKmph };
}
