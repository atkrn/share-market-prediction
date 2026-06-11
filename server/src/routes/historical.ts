import { Router } from "express";
import { generateHistoricalRun } from "../lib/runGeneration.js";
import { getRoute, getRunByDate, getRuns, getStationEvents, getTrain } from "../db/repository.js";
import type { StationEventRow } from "../db/repository.js";
import { offsetToISO } from "../lib/datetime.js";
import { classifyDelay } from "../lib/delay.js";
import { buildTimeDistanceCurve, distanceAtTime } from "../lib/curve.js";
import { positionFromDistance } from "../lib/geo.js";
import { notFound } from "../lib/problem.js";

export const historicalRouter = Router();

// GET /trains/:trainNumber/runs?from=&to=
historicalRouter.get("/:trainNumber/runs", (req, res) => {
  const train = getTrain(req.params.trainNumber);
  if (!train || !train.has_full_data) return notFound(res, `Train ${req.params.trainNumber} not found`);

  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;

  const runs = getRuns(req.params.trainNumber, from, to).map((r) => ({
    run_date: r.run_date,
    status: r.status,
    final_delay_minutes: r.final_delay_min,
    average_speed_kmph: r.avg_speed_kmph,
    data_quality: r.data_quality,
  }));
  res.json(runs);
});

// GET /trains/:trainNumber/runs/:date/replay?resolution_seconds=
historicalRouter.get("/:trainNumber/runs/:date/replay", (req, res) => {
  const train = getTrain(req.params.trainNumber);
  if (!train || !train.has_full_data) return notFound(res, `Train ${req.params.trainNumber} not found`);

  const date = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return notFound(res, `Invalid date ${date}`);

  const route = getRoute(req.params.trainNumber);
  const run = getRunByDate(req.params.trainNumber, date);

  let events: StationEventRow[];
  let status: string;

  if (run) {
    if (run.status === "cancelled") {
      return res.json({
        train_number: train.train_number,
        run_date: date,
        status: "cancelled",
        route_geometry: null,
        positions: [],
        station_events: [],
        summary: null,
      });
    }
    events = getStationEvents(run.id);
    status = run.status;
  } else {
    // Date outside the seeded history window — generate it on the fly
    // using the same deterministic per-date formula as the seed script,
    // so any date is replayable.
    const generated = generateHistoricalRun(
      {
        trainNumber: train.train_number,
        name: train.name,
        nameLocal: train.name_local,
        sourceStation: train.source_station,
        destinationStation: train.destination_station,
        trainType: train.train_type,
        zone: train.zone,
        totalDistanceKm: train.total_distance_km,
        averageSpeedKmph: train.average_speed_kmph,
        runsOnDays: train.runs_on_days,
        originDepartureHour: train.origin_departure_hour,
        originDepartureMinute: train.origin_departure_minute,
        scheduledDurationMin: train.scheduled_duration_min,
        hasFullData: train.has_full_data,
      },
      route.map((s) => ({
        trainNumber: train.train_number,
        sequenceNumber: s.sequence_number,
        stationCode: s.station_code,
        stationName: s.station_name,
        lat: s.lat,
        lon: s.lon,
        distanceFromSourceKm: s.distance_from_source_km,
        scheduledArrivalOffsetMin: s.scheduled_arrival_offset_min,
        scheduledDepartureOffsetMin: s.scheduled_departure_offset_min,
        haltMinutes: s.halt_minutes,
        platformNumber: s.platform_number,
      })),
      date
    );
    events = generated.events.map((e, i) => ({
      sequence_number: e.sequenceNumber,
      station_code: e.stationCode,
      station_name: route[i].station_name,
      scheduled_arrival_offset_min: e.scheduledArrivalOffsetMin,
      scheduled_departure_offset_min: e.scheduledDepartureOffsetMin,
      actual_arrival_offset_min: e.actualArrivalOffsetMin,
      actual_departure_offset_min: e.actualDepartureOffsetMin,
      arrival_delay_min: e.arrivalDelayMin,
      departure_delay_min: e.departureDelayMin,
    }));
    status = "completed";
  }

  const originHour = train.origin_departure_hour ?? 0;
  const originMinute = train.origin_departure_minute ?? 0;

  const stationEvents = events.map((e, i) => ({
    sequence_number: e.sequence_number,
    station_code: e.station_code,
    station_name: e.station_name,
    scheduled_arrival:
      e.scheduled_arrival_offset_min == null ? null : offsetToISO(date, originHour, originMinute, e.scheduled_arrival_offset_min),
    actual_arrival:
      e.actual_arrival_offset_min == null ? null : offsetToISO(date, originHour, originMinute, e.actual_arrival_offset_min),
    scheduled_departure:
      e.scheduled_departure_offset_min == null ? null : offsetToISO(date, originHour, originMinute, e.scheduled_departure_offset_min),
    actual_departure:
      e.actual_departure_offset_min == null ? null : offsetToISO(date, originHour, originMinute, e.actual_departure_offset_min),
    arrival_delay_minutes: e.arrival_delay_min,
    departure_delay_minutes: e.departure_delay_min,
    status: classifyDelay(e.arrival_delay_min, i === 0 ? false : e.arrival_delay_min == null),
  }));

  // Time-distance curve for position sampling.
  const curveEvents = events.map((e, i) => ({
    distanceFromSourceKm: route[i].distance_from_source_km,
    actualArrivalOffsetMin: e.actual_arrival_offset_min,
    actualDepartureOffsetMin: e.actual_departure_offset_min,
  }));
  const curve = buildTimeDistanceCurve(curveEvents);
  const totalDurationMin = curve[curve.length - 1].d === 0 ? 0 : curve[curve.length - 1].t;

  const resolutionSeconds = Math.max(30, Number(req.query.resolution_seconds ?? 60) || 60);
  const resolutionMin = resolutionSeconds / 60;

  const routeGeo = route.map((s) => ({ sequenceNumber: s.sequence_number, code: s.station_code, lat: s.lat, lon: s.lon, distanceFromSourceKm: s.distance_from_source_km }));

  const positions: { t: string; lat: number; lon: number; speed_kmph: number; distance_covered_km: number }[] = [];
  for (let t = 0; t <= totalDurationMin; t += resolutionMin) {
    const d = distanceAtTime(curve, t);
    const prevD = t === 0 ? d : distanceAtTime(curve, Math.max(0, t - resolutionMin));
    const speed = t === 0 ? 0 : Math.round(((d - prevD) / resolutionMin) * 60 * 10) / 10;
    const pos = positionFromDistance(routeGeo, d);
    positions.push({
      t: offsetToISO(date, originHour, originMinute, t),
      lat: pos.lat,
      lon: pos.lon,
      speed_kmph: speed,
      distance_covered_km: Math.round(d * 10) / 10,
    });
  }

  const allDelays = events.flatMap((e) => [e.arrival_delay_min, e.departure_delay_min]).filter((d): d is number => d != null);

  res.json({
    train_number: train.train_number,
    run_date: date,
    status,
    route_geometry: {
      type: "LineString",
      coordinates: route.map((s) => [s.lon, s.lat]),
    },
    positions,
    station_events: stationEvents,
    summary: {
      total_duration_minutes: Math.round(totalDurationMin),
      average_speed_kmph: run?.avg_speed_kmph ?? (totalDurationMin > 0 ? Number(((train.total_distance_km ?? 0) / (totalDurationMin / 60)).toFixed(1)) : 0),
      final_delay_minutes: events[events.length - 1]?.arrival_delay_min ?? 0,
      max_delay_minutes: allDelays.length ? Math.max(...allDelays) : 0,
    },
  });
});
