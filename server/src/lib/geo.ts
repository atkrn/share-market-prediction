export interface RouteStop {
  sequenceNumber: number;
  code: string;
  lat: number;
  lon: number;
  distanceFromSourceKm: number;
}

export function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/** Interpolate a lat/lon position along a route polyline by
 * distance-from-origin (km). */
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
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

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
