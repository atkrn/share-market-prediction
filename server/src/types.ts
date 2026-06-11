export interface RouteStationRow {
  trainNumber: string;
  sequenceNumber: number;
  stationCode: string;
  stationName: string;
  lat: number;
  lon: number;
  distanceFromSourceKm: number;
  scheduledArrivalOffsetMin: number | null;
  scheduledDepartureOffsetMin: number | null;
  haltMinutes: number;
  platformNumber: string | null;
}

export interface TrainRow {
  trainNumber: string;
  name: string;
  nameLocal: string | null;
  sourceStation: string;
  destinationStation: string;
  trainType: string;
  zone: string | null;
  totalDistanceKm: number | null;
  averageSpeedKmph: number | null;
  runsOnDays: string;
  originDepartureHour: number | null;
  originDepartureMinute: number | null;
  scheduledDurationMin: number | null;
  hasFullData: number;
}

/** A single generated/replayed station event, before persistence or
 * serialization — minutes are offsets from origin departure. */
export interface GeneratedStationEvent {
  sequenceNumber: number;
  stationCode: string;
  scheduledArrivalOffsetMin: number | null;
  scheduledDepartureOffsetMin: number | null;
  actualArrivalOffsetMin: number | null;
  actualDepartureOffsetMin: number | null;
  arrivalDelayMin: number | null;
  departureDelayMin: number | null;
}

export interface GeneratedRun {
  status: "running" | "completed";
  events: GeneratedStationEvent[];
  totalDurationMin: number;
  finalDelayMin: number;
  maxDelayMin: number;
  avgSpeedKmph: number;
}
