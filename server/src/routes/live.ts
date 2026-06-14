import { Router } from "express";
import { getRoute, getStationEvents, getTodayRun, getTrain } from "../db/repository.js";
import { offsetToISO } from "../lib/datetime.js";
import { classifyDelay } from "../lib/delay.js";
import { headingAtDistance, positionFromDistance } from "../lib/geo.js";
import { computeLiveProgress } from "../lib/liveSimulation.js";
import { notFound } from "../lib/problem.js";

export const liveRouter = Router();

function loadLiveContext(trainNumber: string) {
  const train = getTrain(trainNumber);
  if (!train || !train.has_full_data) return null;
  const run = getTodayRun(trainNumber);
  if (!run) return null;
  const route = getRoute(trainNumber);
  const events = getStationEvents(run.id);
  return { train, run, route, events };
}

// GET /trains/:trainNumber/live
liveRouter.get("/:trainNumber/live", (req, res) => {
  const ctx = loadLiveContext(req.params.trainNumber);
  if (!ctx) return notFound(res, `Live status for train ${req.params.trainNumber} not found`);
  const { train, run, route, events } = ctx;

  const progress = computeLiveProgress(route, events, train.origin_departure_hour ?? 0, train.origin_departure_minute ?? 0);
  const currentIndex = progress.currentIndex;
  const current = route[currentIndex];
  const next = route[currentIndex + 1];
  const currentEvent = events[currentIndex];
  const nextEvent = events[currentIndex + 1];

  const distanceKm = progress.positionDistanceKm;
  const pos = positionFromDistance(
    route.map((s) => ({ sequenceNumber: s.sequence_number, code: s.station_code, lat: s.lat, lon: s.lon, distanceFromSourceKm: s.distance_from_source_km })),
    distanceKm
  );
  const heading = headingAtDistance(
    route.map((s) => ({ sequenceNumber: s.sequence_number, code: s.station_code, lat: s.lat, lon: s.lon, distanceFromSourceKm: s.distance_from_source_km })),
    distanceKm
  );

  const currentDelay = currentEvent?.departure_delay_min ?? currentEvent?.arrival_delay_min ?? 0;

  const recordedArr = events.slice(1).map((e) => e.arrival_delay_min).filter((d): d is number => d != null);
  const allRecorded = [
    ...recordedArr,
    ...events.map((e) => e.departure_delay_min).filter((d): d is number => d != null),
  ];
  const maxToday = allRecorded.length ? Math.max(...allRecorded) : 0;
  const avgDelay = recordedArr.length ? recordedArr.reduce((a, b) => a + b, 0) / recordedArr.length : 0;

  let trend: "recovering" | "worsening" | "stable" = "stable";
  if (recordedArr.length >= 2) {
    const last = recordedArr[recordedArr.length - 1];
    const prev = recordedArr[recordedArr.length - 2];
    if (last < prev) trend = "recovering";
    else if (last > prev) trend = "worsening";
  }

  const originHour = train.origin_departure_hour ?? 0;
  const originMinute = train.origin_departure_minute ?? 0;
  const nextPredictedDelay = next ? nextEvent?.arrival_delay_min ?? currentDelay : null;

  res.json({
    train_number: train.train_number,
    name: train.name,
    run_date: run.run_date,
    status: run.status,
    current_station: current ? { code: current.station_code, name: current.station_name } : null,
    next_station: next
      ? {
          code: next.station_code,
          name: next.station_name,
          scheduled_arrival: offsetToISO(run.run_date, originHour, originMinute, next.scheduled_arrival_offset_min ?? 0),
          predicted_arrival: offsetToISO(run.run_date, originHour, originMinute, (next.scheduled_arrival_offset_min ?? 0) + (nextPredictedDelay ?? 0)),
          predicted_delay_minutes: nextPredictedDelay,
        }
      : null,
    position: {
      lat: pos.lat,
      lon: pos.lon,
      speed_kmph: progress.positionSpeedKmph,
      heading_degrees: heading,
      distance_covered_km: distanceKm,
      distance_remaining_km: Math.max(0, (train.total_distance_km ?? 0) - distanceKm),
    },
    delay: {
      current_minutes: currentDelay,
      max_today_minutes: maxToday,
      average_minutes: Math.round(avgDelay * 10) / 10,
      trend,
    },
    data_freshness: {
      last_updated: new Date().toISOString(),
      source: run.source,
      staleness_seconds: 0,
    },
  });
});

// GET /trains/:trainNumber/live/schedule
liveRouter.get("/:trainNumber/live/schedule", (req, res) => {
  const ctx = loadLiveContext(req.params.trainNumber);
  if (!ctx) return notFound(res, `Live schedule for train ${req.params.trainNumber} not found`);
  const { train, run, route, events } = ctx;

  const originHour = train.origin_departure_hour ?? 0;
  const originMinute = train.origin_departure_minute ?? 0;
  const progress = computeLiveProgress(route, events, originHour, originMinute);

  const schedule = events.map((e, i) => {
    const isPending = i >= progress.predictedFromIndex;
    return {
      sequence_number: e.sequence_number,
      station_code: e.station_code,
      station_name: e.station_name,
      scheduled_arrival:
        e.scheduled_arrival_offset_min == null ? null : offsetToISO(run.run_date, originHour, originMinute, e.scheduled_arrival_offset_min),
      actual_arrival:
        e.actual_arrival_offset_min == null ? null : offsetToISO(run.run_date, originHour, originMinute, e.actual_arrival_offset_min),
      scheduled_departure:
        e.scheduled_departure_offset_min == null ? null : offsetToISO(run.run_date, originHour, originMinute, e.scheduled_departure_offset_min),
      actual_departure:
        e.actual_departure_offset_min == null ? null : offsetToISO(run.run_date, originHour, originMinute, e.actual_departure_offset_min),
      arrival_delay_minutes: e.arrival_delay_min,
      departure_delay_minutes: e.departure_delay_min,
      status: classifyDelay(e.arrival_delay_min, isPending && e.arrival_delay_min == null),
      is_current: i === progress.currentIndex,
      is_pending: isPending,
    };
  });

  res.json(schedule);
});
