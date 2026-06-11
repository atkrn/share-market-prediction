export interface CurvePoint {
  /** minutes from origin departure */
  t: number;
  /** km from origin */
  d: number;
}

export interface CurveEvent {
  distanceFromSourceKm: number;
  actualArrivalOffsetMin: number | null;
  actualDepartureOffsetMin: number | null;
}

/** Build the time->distance curve used to interpolate the train's
 * position at any point in the journey. Mirrors
 * `buildTimeDistanceCurve` in web/src/lib/timeMachine.ts. */
export function buildTimeDistanceCurve(events: CurveEvent[]): CurvePoint[] {
  const points: CurvePoint[] = [];
  events.forEach((e, i) => {
    if (i === 0) {
      points.push({ t: 0, d: 0 });
      if (e.actualDepartureOffsetMin != null) points.push({ t: e.actualDepartureOffsetMin, d: 0 });
      return;
    }
    points.push({ t: e.actualArrivalOffsetMin as number, d: e.distanceFromSourceKm });
    if (e.actualDepartureOffsetMin != null) {
      points.push({ t: e.actualDepartureOffsetMin, d: e.distanceFromSourceKm });
    }
  });
  return points;
}

export function distanceAtTime(curve: CurvePoint[], t: number): number {
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (t >= a.t && t <= b.t) {
      if (b.t === a.t) return a.d;
      const f = (t - a.t) / (b.t - a.t);
      return a.d + (b.d - a.d) * f;
    }
  }
  return curve[curve.length - 1].d;
}
