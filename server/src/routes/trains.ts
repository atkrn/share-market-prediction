import { Router } from "express";
import { getRoute, getTrain, searchTrains } from "../db/repository.js";
import { notFound } from "../lib/problem.js";

export const trainsRouter = Router();

function toTrainSummary(t: { train_number: string; name: string; name_local: string | null; source_station: string; destination_station: string; train_type: string }) {
  return {
    train_number: t.train_number,
    name: t.name,
    name_local: t.name_local,
    source_station: t.source_station,
    destination_station: t.destination_station,
    train_type: t.train_type,
  };
}

// GET /trains/search?q=&limit=
trainsRouter.get("/search", (req, res) => {
  const q = String(req.query.q ?? "");
  const limit = Math.min(50, Number(req.query.limit ?? 10) || 10);
  const results = searchTrains(q, limit).map(toTrainSummary);
  res.json(results);
});

// GET /trains/:trainNumber
trainsRouter.get("/:trainNumber", (req, res) => {
  const train = getTrain(req.params.trainNumber);
  if (!train || !train.has_full_data) {
    return notFound(res, `Train ${req.params.trainNumber} not found`);
  }
  res.json({
    ...toTrainSummary(train),
    zone: train.zone,
    total_distance_km: train.total_distance_km,
    average_speed_kmph: train.average_speed_kmph,
    runs_on_days: train.runs_on_days,
  });
});

// GET /trains/:trainNumber/route
trainsRouter.get("/:trainNumber/route", (req, res) => {
  const train = getTrain(req.params.trainNumber);
  if (!train || !train.has_full_data) {
    return notFound(res, `Train ${req.params.trainNumber} not found`);
  }
  const route = getRoute(req.params.trainNumber).map((s) => ({
    sequence_number: s.sequence_number,
    station_code: s.station_code,
    station_name: s.station_name,
    distance_from_source_km: s.distance_from_source_km,
    scheduled_arrival_offset_minutes: s.scheduled_arrival_offset_min,
    scheduled_departure_offset_minutes: s.scheduled_departure_offset_min,
    halt_minutes: s.halt_minutes,
    platform_number: s.platform_number,
  }));
  res.json(route);
});
