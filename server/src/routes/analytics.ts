import { Router } from "express";
import {
  getDailyDelayTrend,
  getDayOfWeekDelays,
  getInsights,
  getOverallStats,
  getReliabilityRow,
  getStationAverageDelays,
  getTrain,
} from "../db/repository.js";
import { notFound } from "../lib/problem.js";

export const analyticsRouter = Router();

const WINDOW_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
const HISTORY_DAYS = 180; // matches db/seed.ts HISTORY_DAYS

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// GET /trains/:trainNumber/analytics?window=
analyticsRouter.get("/:trainNumber/analytics", (req, res) => {
  const train = getTrain(req.params.trainNumber);
  if (!train || !train.has_full_data) return notFound(res, `Train ${req.params.trainNumber} not found`);

  const windowParam = typeof req.query.window === "string" ? req.query.window : "30d";
  const days = Math.min(WINDOW_DAYS[windowParam] ?? 30, HISTORY_DAYS);

  const stats = getOverallStats(req.params.trainNumber, days);
  const stationDelays = getStationAverageDelays(req.params.trainNumber, days);

  const intermediate = stationDelays.filter((s, i) => i > 0 && i < stationDelays.length); // exclude origin (already excluded by query)
  const mostDelayed = [...intermediate]
    .sort((a, b) => b.avg_delay - a.avg_delay)
    .slice(0, 3)
    .map((s) => ({
      station_code: s.station_code,
      station_name: s.station_name,
      average_delay_minutes: Math.round(s.avg_delay * 10) / 10,
    }));

  // Recovery: stations where the average delay improved vs. the
  // previous station on the route, taken from the second half of the
  // journey (where recovery typically happens).
  const recovery: { station_code: string; station_name: string; average_recovery_minutes: number }[] = [];
  for (let i = Math.ceil(stationDelays.length / 2); i < stationDelays.length; i++) {
    const prev = stationDelays[i - 1];
    const cur = stationDelays[i];
    const recovered = prev.avg_delay - cur.avg_delay;
    if (recovered > 0) {
      recovery.push({
        station_code: cur.station_code,
        station_name: cur.station_name,
        average_recovery_minutes: Math.round(recovered * 10) / 10,
      });
    }
  }
  recovery.sort((a, b) => b.average_recovery_minutes - a.average_recovery_minutes);

  const dayOfWeek = getDayOfWeekDelays(req.params.trainNumber, days);
  const dayOfWeekMap = new Map(dayOfWeek.map((d) => [d.dow, d.avg_delay]));
  // Mon..Sun ordering for the UI chart.
  const dayOfWeekPerformance = [1, 2, 3, 4, 5, 6, 0].map((dow) => ({
    day: DOW_LABELS[dow],
    average_delay_minutes: Math.round((dayOfWeekMap.get(dow) ?? 0) * 10) / 10,
  }));

  const trend = getDailyDelayTrend(req.params.trainNumber, Math.min(30, days));

  res.json({
    train_number: train.train_number,
    window: windowParam,
    average_delay_minutes: Math.round((stats.avg_delay ?? 0) * 10) / 10,
    max_delay_minutes: stats.max_delay ?? 0,
    most_delayed_stations: mostDelayed,
    recovery_stations: recovery.slice(0, 2),
    day_of_week_performance: dayOfWeekPerformance,
    // Additional fields beyond the documented OpenAPI schema, used by the
    // Performance dashboard's KPI row and trend chart.
    punctuality_pct: Math.round((stats.punctuality_frac ?? 0) * 1000) / 10,
    average_speed_kmph: stats.avg_speed != null ? Math.round(stats.avg_speed * 10) / 10 : null,
    delay_trend: trend.map((d) => Math.max(0, Math.round(d.avg_delay ?? 0))),
  });
});

// GET /trains/:trainNumber/reliability
analyticsRouter.get("/:trainNumber/reliability", (req, res) => {
  const train = getTrain(req.params.trainNumber);
  if (!train || !train.has_full_data) return notFound(res, `Train ${req.params.trainNumber} not found`);

  const row = getReliabilityRow(req.params.trainNumber);
  if (!row) return notFound(res, `Reliability score for train ${req.params.trainNumber} not found`);

  res.json({
    train_number: row.train_number,
    score: row.score,
    computed_at: row.computed_at,
    components: {
      punctuality: row.punctuality,
      consistency: row.consistency,
      cancellations: row.cancellations,
      severe_delays: row.severe_delays,
    },
    history: [],
    best_month: row.best_month_label ? { label: row.best_month_label, score: row.best_month_score } : null,
    worst_month: row.worst_month_label ? { label: row.worst_month_label, score: row.worst_month_score } : null,
  });
});

// GET /trains/:trainNumber/insights
analyticsRouter.get("/:trainNumber/insights", (req, res) => {
  const train = getTrain(req.params.trainNumber);
  if (!train || !train.has_full_data) return notFound(res, `Train ${req.params.trainNumber} not found`);

  const insights = getInsights(req.params.trainNumber).map((i) => ({
    run_date: i.run_date,
    text: i.text,
    generated_at: i.generated_at,
    confidence: i.confidence,
  }));
  res.json(insights);
});
