/** Convert a "minutes from origin departure" offset into an absolute ISO
 * 8601 timestamp, given the run's calendar date and the train's
 * wall-clock origin departure time (24h, IST in the source data — stored
 * as plain hour/minute and treated as UTC here since this is mock data). */
export function offsetToISO(
  runDate: string,
  originHour: number,
  originMinute: number,
  offsetMin: number
): string {
  const d = new Date(`${runDate}T00:00:00.000Z`);
  d.setUTCMinutes(d.getUTCMinutes() + originHour * 60 + originMinute + Math.round(offsetMin));
  return d.toISOString();
}
