import type { RouteStop, TrainMeta, TrainSummary } from "@/lib/types";

/**
 * Mock data layer — shaped exactly like the records the real Tracking /
 * Schedule services would return (see docs/rail-intelligence-platform/05-database-schema.md
 * and api/openapi.yaml). Swapping `lib/api.ts` to call the real backend
 * later does not require any UI changes.
 */

const MUMBAI_RAJDHANI_ROUTE: RouteStop[] = [
  { sequenceNumber: 1, code: "NDLS", name: "New Delhi", lat: 28.6429, lon: 77.2191, distanceFromSourceKm: 0, scheduledArrivalOffsetMin: null, scheduledDepartureOffsetMin: 0, haltMinutes: 0, platform: "1" },
  { sequenceNumber: 2, code: "MTJ", name: "Mathura Jn", lat: 27.4924, lon: 77.6737, distanceFromSourceKm: 141, scheduledArrivalOffsetMin: 130, scheduledDepartureOffsetMin: 132, haltMinutes: 2, platform: "3" },
  { sequenceNumber: 3, code: "KOTA", name: "Kota Jn", lat: 25.1804, lon: 75.8648, distanceFromSourceKm: 463, scheduledArrivalOffsetMin: 278, scheduledDepartureOffsetMin: 283, haltMinutes: 5, platform: "2" },
  { sequenceNumber: 4, code: "BRC", name: "Vadodara Jn", lat: 22.3072, lon: 73.1812, distanceFromSourceKm: 944, scheduledArrivalOffsetMin: 535, scheduledDepartureOffsetMin: 540, haltMinutes: 5, platform: "1" },
  { sequenceNumber: 5, code: "ST", name: "Surat", lat: 21.1702, lon: 72.8311, distanceFromSourceKm: 1027, scheduledArrivalOffsetMin: 593, scheduledDepartureOffsetMin: 595, haltMinutes: 2, platform: "2" },
  { sequenceNumber: 6, code: "BVI", name: "Borivali", lat: 19.2288, lon: 72.8567, distanceFromSourceKm: 1349, scheduledArrivalOffsetMin: 787, scheduledDepartureOffsetMin: 789, haltMinutes: 2, platform: "5" },
  { sequenceNumber: 7, code: "BCT", name: "Mumbai Central", lat: 18.9696, lon: 72.8205, distanceFromSourceKm: 1384, scheduledArrivalOffsetMin: 820, scheduledDepartureOffsetMin: null, haltMinutes: 0, platform: "-" },
];

const BHOPAL_SHATABDI_ROUTE: RouteStop[] = [
  { sequenceNumber: 1, code: "NDLS", name: "New Delhi", lat: 28.6429, lon: 77.2191, distanceFromSourceKm: 0, scheduledArrivalOffsetMin: null, scheduledDepartureOffsetMin: 0, haltMinutes: 0, platform: "1" },
  { sequenceNumber: 2, code: "AGC", name: "Agra Cantt", lat: 27.1592, lon: 78.0092, distanceFromSourceKm: 195, scheduledArrivalOffsetMin: 131, scheduledDepartureOffsetMin: 133, haltMinutes: 2, platform: "1" },
  { sequenceNumber: 3, code: "GWL", name: "Gwalior Jn", lat: 26.2183, lon: 78.1828, distanceFromSourceKm: 308, scheduledArrivalOffsetMin: 213, scheduledDepartureOffsetMin: 215, haltMinutes: 2, platform: "1" },
  { sequenceNumber: 4, code: "JHS", name: "Jhansi Jn", lat: 25.4484, lon: 78.5685, distanceFromSourceKm: 403, scheduledArrivalOffsetMin: 273, scheduledDepartureOffsetMin: 278, haltMinutes: 5, platform: "1" },
  { sequenceNumber: 5, code: "BPL", name: "Bhopal Jn", lat: 23.2599, lon: 77.4126, distanceFromSourceKm: 707, scheduledArrivalOffsetMin: 485, scheduledDepartureOffsetMin: null, haltMinutes: 0, platform: "1" },
];

export const TRAIN_METAS: Record<string, TrainMeta> = {
  "12951": {
    trainNumber: "12951",
    name: "Mumbai Rajdhani",
    nameLocal: "मुंबई राजधानी",
    sourceStation: "NDLS",
    destinationStation: "BCT",
    trainType: "rajdhani",
    zone: "WR",
    totalDistanceKm: 1384,
    averageSpeedKmph: 76.3,
    runsOnDays: "1111111",
    originDeparture: { hour: 16, minute: 55 },
    scheduledDurationMin: 820,
    route: MUMBAI_RAJDHANI_ROUTE,
    liveRun: {
      status: "running",
      arrivalDelays: [null, 6, 22, 14, 14, 13, 13],
      departureDelays: [0, 8, 22, 13, 14, 13, null],
      predictedFromIndex: 4,
      currentIndex: 3,
      position: { distanceKm: 960, speedKmph: 92, headingDeg: 200 },
      source: "crowd_gps",
    },
  },
  "12002": {
    trainNumber: "12002",
    name: "Bhopal Shatabdi",
    nameLocal: "भोपाल शताब्दी",
    sourceStation: "NDLS",
    destinationStation: "BPL",
    trainType: "shatabdi",
    zone: "NCR",
    totalDistanceKm: 707,
    averageSpeedKmph: 87.5,
    runsOnDays: "1111111",
    originDeparture: { hour: 6, minute: 0 },
    scheduledDurationMin: 485,
    route: BHOPAL_SHATABDI_ROUTE,
    liveRun: {
      status: "running",
      arrivalDelays: [null, 8, 12, 15, 7],
      departureDelays: [0, 9, 13, 16, null],
      predictedFromIndex: 3,
      currentIndex: 2,
      position: { distanceKm: 340, speedKmph: 95, headingDeg: 155 },
      source: "ntes_scrape",
    },
  },
};

/** Search index — includes trains beyond the demo dataset to show how
 * search/autocomplete behaves at scale; trains without an entry in
 * TRAIN_METAS render a "coming soon" placeholder (consistent with the
 * phased "top 500 trains" rollout in docs/rail-intelligence-platform/02-prd.md). */
export const TRAIN_SUMMARIES: TrainSummary[] = [
  { trainNumber: "12951", name: "Mumbai Rajdhani", nameLocal: "मुंबई राजधानी", sourceStation: "NDLS", destinationStation: "BCT", trainType: "rajdhani" },
  { trainNumber: "12002", name: "Bhopal Shatabdi", nameLocal: "भोपाल शताब्दी", sourceStation: "NDLS", destinationStation: "BPL", trainType: "shatabdi" },
  { trainNumber: "12301", name: "Howrah Rajdhani", nameLocal: "हावड़ा राजधानी", sourceStation: "NDLS", destinationStation: "HWH", trainType: "rajdhani" },
  { trainNumber: "12259", name: "Sealdah Duronto", nameLocal: "सियालदह दुरंतो", sourceStation: "NDLS", destinationStation: "SDAH", trainType: "duronto" },
  { trainNumber: "12626", name: "Kerala Express", nameLocal: "केरल एक्सप्रेस", sourceStation: "NDLS", destinationStation: "TVC", trainType: "superfast" },
  { trainNumber: "12909", name: "Garib Rath Express", nameLocal: "गरीब रथ एक्सप्रेस", sourceStation: "BDTS", destinationStation: "NZM", trainType: "express" },
];

export function findTrainSummary(trainNumber: string): TrainSummary | undefined {
  return TRAIN_SUMMARIES.find((t) => t.trainNumber === trainNumber);
}

export function getTrainMeta(trainNumber: string): TrainMeta | undefined {
  return TRAIN_METAS[trainNumber];
}

export function searchTrains(query: string, limit = 10): TrainSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return TRAIN_SUMMARIES.slice(0, limit);
  return TRAIN_SUMMARIES.filter(
    (t) =>
      t.trainNumber.includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.sourceStation.toLowerCase().includes(q) ||
      t.destinationStation.toLowerCase().includes(q)
  ).slice(0, limit);
}
