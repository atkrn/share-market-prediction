import type { RouteStop } from "@/lib/types";

export type DelayBand = "early" | "ontime" | "delayed" | "pending";

export interface DelayInfo {
  label: string;
  band: DelayBand;
}

/**
 * Format an offset in minutes-from-origin-departure as a wall-clock
 * "HH:MM" string, with a "(+Nd)" suffix for multi-day journeys.
 */
export function formatTime(
  minutesFromStart: number | null,
  origin: { hour: number; minute: number }
): string {
  if (minutesFromStart == null) return "—";
  const total = origin.hour * 60 + origin.minute + Math.round(minutesFromStart);
  const dayOffset = Math.floor(total / 1440);
  const tod = ((total % 1440) + 1440) % 1440;
  const h = String(Math.floor(tod / 60)).padStart(2, "0");
  const m = String(tod % 60).padStart(2, "0");
  return `${h}:${m}${dayOffset > 0 ? ` (+${dayOffset}d)` : ""}`;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "1111111" -> "Daily"; "1010100" -> "Mon, Wed, Fri" */
export function formatRunsOnDays(bits: string): string {
  if (bits === "1111111") return "Daily";
  const days = bits
    .split("")
    .map((b, i) => (b === "1" ? DAY_LABELS[i] : null))
    .filter((d): d is string => d != null);
  return days.length ? days.join(", ") : "—";
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

/**
 * Classify a delay value into a UI band.
 * - delay < 0 -> early (green)
 * - delay === 0 -> on time (yellow)
 * - 0 < delay <= 15 -> minor delay, still "ontime" band (yellow)
 * - delay > 15 -> delayed (red)
 * Matches the >15min threshold used in docs/rail-intelligence-platform/08-ui-wireframes.md.
 */
export function delayInfo(delay: number | null, isPending = false): DelayInfo {
  if (isPending) return { label: "Pending", band: "pending" };
  if (delay == null) return { label: "—", band: "pending" };
  if (delay < 0) return { label: `${Math.abs(delay)}m early`, band: "early" };
  if (delay === 0) return { label: "On time", band: "ontime" };
  if (delay <= 15) return { label: `+${delay}m`, band: "ontime" };
  return { label: `+${delay}m`, band: "delayed" };
}

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Interpolate a lat/lon position along a route's station polyline by
 * distance-from-origin (km). Falls back to the last station beyond the
 * route's total distance. */
export function positionFromDistance(
  route: RouteStop[],
  distanceKm: number
): { lat: number; lon: number } {
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (distanceKm >= a.distanceFromSourceKm && distanceKm <= b.distanceFromSourceKm) {
      const span = b.distanceFromSourceKm - a.distanceFromSourceKm;
      const f = span === 0 ? 0 : (distanceKm - a.distanceFromSourceKm) / span;
      return { lat: lerp(a.lat, b.lat, f), lon: lerp(a.lon, b.lon, f) };
    }
  }
  const last = route[route.length - 1];
  return { lat: last.lat, lon: last.lon };
}

/** Compass bearing (degrees) from point a to point b. */
export function computeHeading(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Heading of the route segment containing `distanceKm`, used to orient
 * the train marker. */
export function headingAtDistance(route: RouteStop[], distanceKm: number): number {
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if (distanceKm >= a.distanceFromSourceKm && distanceKm <= b.distanceFromSourceKm) {
      return computeHeading(a, b);
    }
  }
  const a = route[route.length - 2];
  const b = route[route.length - 1];
  return computeHeading(a, b);
}
