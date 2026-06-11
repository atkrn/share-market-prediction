import { getAnalyticsSummary, getReliabilityScore } from "@/lib/data/analytics";
import {
  findTrainSummary,
  getTrainMeta,
  searchTrains as searchTrainsSync,
  TRAIN_SUMMARIES,
} from "@/lib/data/trains";
import { getInsights as deriveInsights, getLiveSchedule as deriveLiveSchedule, getLiveStatus as deriveLiveStatus, getPredictions as derivePredictions } from "@/lib/derive";
import { generateRunData, getAvailableDates as computeAvailableDates, getRunSummaries } from "@/lib/timeMachine";
import type {
  AnalyticsSummary,
  Insight,
  LiveStatus,
  PredictionSet,
  ReliabilityScore,
  ReplayPayload,
  RunSummary,
  StationEvent,
  TrainMeta,
  TrainSummary,
} from "@/lib/types";

/**
 * Thin async data-access layer. Every function here mirrors an endpoint
 * in api/openapi.yaml and currently reads from the in-memory mock dataset
 * (lib/data/*). Swapping to the real backend means re-implementing the
 * bodies of these functions with `fetch(...)` calls — UI code does not
 * need to change.
 */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function searchTrains(query: string, limit = 10): Promise<TrainSummary[]> {
  return searchTrainsSync(query, limit);
}

export async function getTrainSummary(trainNumber: string): Promise<TrainSummary | null> {
  return findTrainSummary(trainNumber) ?? null;
}

export async function getTrain(trainNumber: string): Promise<TrainMeta | null> {
  return getTrainMeta(trainNumber) ?? null;
}

export async function getLiveStatus(trainNumber: string): Promise<LiveStatus | null> {
  const train = getTrainMeta(trainNumber);
  if (!train) return null;
  return deriveLiveStatus(train);
}

export async function getLiveSchedule(trainNumber: string): Promise<StationEvent[]> {
  const train = getTrainMeta(trainNumber);
  if (!train) return [];
  return deriveLiveSchedule(train);
}

export async function getInsights(trainNumber: string): Promise<Insight[]> {
  const train = getTrainMeta(trainNumber);
  if (!train) return [];
  return deriveInsights(train);
}

export async function getPredictions(trainNumber: string): Promise<PredictionSet | null> {
  const train = getTrainMeta(trainNumber);
  if (!train) return null;
  return derivePredictions(train);
}

export async function getAvailableDates(trainNumber: string): Promise<string[]> {
  if (!getTrainMeta(trainNumber)) return [];
  return computeAvailableDates();
}

export async function getRuns(trainNumber: string): Promise<RunSummary[]> {
  const train = getTrainMeta(trainNumber);
  if (!train) return [];
  const dates = computeAvailableDates();
  return getRunSummaries(train, dates, dates[0]);
}

export async function getReplay(trainNumber: string, date: string): Promise<ReplayPayload | null> {
  const train = getTrainMeta(trainNumber);
  if (!train) return null;
  const dates = computeAvailableDates();
  const run = generateRunData(train, date, dates[0]);
  return { trainNumber, runDate: date, run };
}

export async function getAnalytics(trainNumber: string, window = "30d"): Promise<AnalyticsSummary | null> {
  const train = getTrainMeta(trainNumber);
  if (!train) return null;
  return getAnalyticsSummary(train, window);
}

export async function getReliability(trainNumber: string): Promise<ReliabilityScore | null> {
  const train = getTrainMeta(trainNumber);
  if (!train) return null;
  return getReliabilityScore(train);
}

export async function getPopularTrains(limit = 6): Promise<TrainSummary[]> {
  return TRAIN_SUMMARIES.slice(0, limit);
}
