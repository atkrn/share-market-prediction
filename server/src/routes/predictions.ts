import { Router } from "express";
import { getRoute, getStationEvents, getTodayRun, getTrain } from "../db/repository.js";
import { offsetToISO } from "../lib/datetime.js";
import { computeLiveProgress } from "../lib/liveSimulation.js";
import { notFound } from "../lib/problem.js";

export const predictionsRouter = Router();

// GET /trains/:trainNumber/predictions
// Heuristic stand-in for the XGBoost model in
// docs/rail-intelligence-platform/15-ai-features.md, mirroring
// `getPredictions` in web/src/lib/derive.ts: the current delay carries
// forward to the next station (recovering by 1 minute) and to the
// destination (recovering by 5 minutes), floored at zero.
predictionsRouter.get("/:trainNumber/predictions", (req, res) => {
  const train = getTrain(req.params.trainNumber);
  if (!train || !train.has_full_data) return notFound(res, `Train ${req.params.trainNumber} not found`);

  const run = getTodayRun(req.params.trainNumber);
  if (!run) return notFound(res, `Predictions for train ${req.params.trainNumber} not found`);

  const route = getRoute(req.params.trainNumber);
  const events = getStationEvents(run.id);

  const currentIndex = computeLiveProgress(route, events, train.origin_departure_hour ?? 0, train.origin_departure_minute ?? 0).currentIndex;
  const currentEvent = events[currentIndex];
  const currentDelay = currentEvent?.departure_delay_min ?? currentEvent?.arrival_delay_min ?? 0;

  const nextIndex = Math.min(currentIndex + 1, route.length - 1);
  const next = route[nextIndex];
  const destination = route[route.length - 1];

  const predictedNextDelay = Math.max(0, currentDelay - 1);
  const predictedFinalDelay = Math.max(0, currentDelay - 5);

  const originHour = train.origin_departure_hour ?? 0;
  const originMinute = train.origin_departure_minute ?? 0;

  res.json({
    train_number: train.train_number,
    // Additional field beyond the documented OpenAPI schema: the date this
    // prediction's run belongs to, needed by the web app to convert
    // `predicted_arrival` timestamps back into minutes-from-origin offsets.
    run_date: run.run_date,
    next_station: {
      station_code: next.station_code,
      predicted_arrival: offsetToISO(run.run_date, originHour, originMinute, (next.scheduled_arrival_offset_min ?? 0) + predictedNextDelay),
      predicted_delay_minutes: predictedNextDelay,
      confidence: 0.85,
    },
    destination: {
      station_code: destination.station_code,
      predicted_arrival: offsetToISO(run.run_date, originHour, originMinute, (destination.scheduled_arrival_offset_min ?? 0) + predictedFinalDelay),
      predicted_delay_minutes: predictedFinalDelay,
      confidence: 0.74,
    },
    further_delay_probability: 0.18,
    model_version: "xgboost-eta-v0.3.1",
  });
});
