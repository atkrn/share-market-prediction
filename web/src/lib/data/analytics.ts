import { hashStr, mulberry32 } from "@/lib/timeMachine";
import type { AnalyticsSummary, ReliabilityScore, StationDelayStat, TrainMeta } from "@/lib/types";

/** Max possible deduction per component, from the Reliability Score
 * formula in docs/rail-intelligence-platform/04-feature-breakdown.md §4.4.1. */
export const RELIABILITY_MAX_DEDUCTIONS = {
  punctuality: 40,
  consistency: 30,
  cancellations: 20,
  severeDelays: 10,
} as const;

export function getAnalyticsSummary(train: TrainMeta, window = "30d"): AnalyticsSummary {
  const rng = mulberry32(hashStr(`${train.trainNumber}-analytics-${window}`));
  const avgDelay = Math.round((6 + rng() * 10) * 10) / 10;
  const maxDelay = Math.round(avgDelay * (2 + rng()));
  const punctualityPct = Math.max(0, Math.round((100 - avgDelay * 1.5 - rng() * 5) * 10) / 10);
  const avgSpeed = train.averageSpeedKmph + (rng() - 0.5) * 8;

  const intermediate = train.route.slice(1, -1);
  const stationDelays: StationDelayStat[] = intermediate.map((s) => ({
    stationCode: s.code,
    stationName: s.name,
    avgMinutes: Math.round(avgDelay * (0.4 + rng() * 1.4) * 10) / 10,
  }));
  const mostDelayedStations = [...stationDelays]
    .sort((a, b) => b.avgMinutes - a.avgMinutes)
    .slice(0, 3);

  const recoveryStations: StationDelayStat[] = intermediate
    .slice(Math.ceil(intermediate.length / 2))
    .map((s) => ({
      stationCode: s.code,
      stationName: s.name,
      avgMinutes: -Math.round(avgDelay * (0.3 + rng() * 0.6) * 10) / 10,
    }))
    .slice(0, 2);

  const delayTrend = Array.from({ length: 30 }, () =>
    Math.max(0, Math.round(avgDelay + (rng() - 0.5) * 2 * avgDelay))
  );
  const dayOfWeekAvgDelay = Array.from({ length: 7 }, () =>
    Math.max(0, Math.round(avgDelay + (rng() - 0.5) * avgDelay))
  );

  return {
    trainNumber: train.trainNumber,
    window,
    averageDelayMinutes: avgDelay,
    maxDelayMinutes: maxDelay,
    punctualityPct,
    averageSpeedKmph: Math.round(avgSpeed * 10) / 10,
    mostDelayedStations,
    recoveryStations,
    delayTrend,
    dayOfWeekAvgDelay,
  };
}

export function getReliabilityScore(train: TrainMeta): ReliabilityScore {
  const analytics = getAnalyticsSummary(train);
  const rng = mulberry32(hashStr(`${train.trainNumber}-reliability`));
  const stddev = analytics.averageDelayMinutes * (0.3 + rng() * 0.4);
  const cancellationRate = rng() < 0.5 ? 0 : rng() * 0.02;
  const severeDelayRate = rng() < 0.6 ? 0 : rng() * 0.04;

  const punctuality = Math.min(
    RELIABILITY_MAX_DEDUCTIONS.punctuality,
    analytics.averageDelayMinutes * 1.2
  );
  const consistency = Math.min(RELIABILITY_MAX_DEDUCTIONS.consistency, stddev * 1.5);
  const cancellations = Math.min(
    RELIABILITY_MAX_DEDUCTIONS.cancellations,
    cancellationRate * 100 * 2
  );
  const severeDelays = Math.min(RELIABILITY_MAX_DEDUCTIONS.severeDelays, severeDelayRate * 100);

  const rawScore = 100 - punctuality - consistency - cancellations - severeDelays;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    trainNumber: train.trainNumber,
    score,
    computedAt: new Date().toISOString(),
    components: {
      punctuality: Math.round(punctuality * 10) / 10,
      consistency: Math.round(consistency * 10) / 10,
      cancellations: Math.round(cancellations * 10) / 10,
      severeDelays: Math.round(severeDelays * 10) / 10,
    },
    bestMonth: { label: "Jan 2026", score: Math.min(100, score + 8) },
    worstMonth: { label: "Aug 2025", score: Math.max(0, score - 16) },
  };
}
