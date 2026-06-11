export type StationEventStatus = "early" | "on_time" | "delayed" | "pending";

/** Classify an arrival delay into the StationEvent.status enum.
 * Mirrors the >15min "delayed" threshold used by the web app
 * (web/src/lib/format.ts `delayInfo`). */
export function classifyDelay(delayMin: number | null, isPending: boolean): StationEventStatus {
  if (isPending) return "pending";
  if (delayMin == null) return "pending";
  if (delayMin < 0) return "early";
  if (delayMin <= 15) return "on_time";
  return "delayed";
}
