import Card from "@/components/ui/Card";
import DelayPill from "@/components/ui/DelayPill";
import Kpi from "@/components/ui/Kpi";
import { delayInfo, formatTime } from "@/lib/format";
import type { LiveStatus, StationEvent, TrainMeta } from "@/lib/types";

interface ScheduleTabProps {
  train: TrainMeta;
  liveStatus: LiveStatus;
  liveSchedule: StationEvent[];
}

export default function ScheduleTab({ train, liveStatus, liveSchedule }: ScheduleTabProps) {
  const recorded = liveSchedule
    .map((s, i) => ({ s, i, val: Math.max(s.arrivalDelayMin ?? -Infinity, s.departureDelayMin ?? -Infinity) }))
    .filter((x) => x.val > -Infinity && x.i <= train.liveRun.currentIndex);

  const peak = recorded.length ? recorded.reduce((max, x) => (x.val > max.val ? x : max)) : null;
  const currentDelay = liveStatus.delay.currentMinutes;
  const recovery = peak ? peak.val - currentDelay : 0;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          value={`${currentDelay}m`}
          label="Current Delay"
          valueClassName={currentDelay > 0 ? "text-delayed" : currentDelay < 0 ? "text-early" : "text-ontime"}
        />
        <Kpi
          value={`${peak?.val ?? 0}m`}
          label={peak ? `Max Delay Today (${peak.s.stationName})` : "Max Delay Today"}
        />
        <Kpi value={`${liveStatus.delay.averageMinutes}m`} label="Average Delay" />
        <Kpi
          value={recovery > 0 ? `-${recovery}m` : `${recovery}m`}
          label={peak && peak.i > 0 ? `Recovered Since ${peak.s.stationName}` : "Recovered"}
          valueClassName={recovery > 0 ? "text-early" : ""}
        />
      </div>

      <Card title="Schedule vs Actual — Today">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["Station", "Plat", "Sched Arr", "Actual Arr", "Sched Dep", "Actual Dep", "Delay"].map((h) => (
                <th key={h} className="border-b border-border px-2.5 py-2 text-left text-xs font-semibold uppercase text-text-dim">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liveSchedule.map((s, i) => {
              const arrDi = delayInfo(s.arrivalDelayMin, s.isPending && s.arrivalDelayMin == null);
              const arrActual =
                i === 0
                  ? "—"
                  : `${s.isPending ? "ETA " : ""}${formatTime(s.actualArrivalOffsetMin, train.originDeparture)}`;
              let depActual: string;
              if (s.scheduledDepartureOffsetMin == null) {
                depActual = "—";
              } else if (s.actualDepartureOffsetMin == null) {
                depActual = s.isCurrent ? "(now)" : "—";
              } else {
                depActual = `${s.isPending ? "ETA " : ""}${formatTime(s.actualDepartureOffsetMin, train.originDeparture)}`;
              }
              return (
                <tr key={s.stationCode} className={s.isCurrent ? "bg-brand/[0.08]" : ""}>
                  <td className="border-b border-border px-2.5 py-2">
                    {s.stationName} <span className="text-text-dim">({s.stationCode})</span>
                  </td>
                  <td className="border-b border-border px-2.5 py-2">{s.platform ?? "—"}</td>
                  <td className="border-b border-border px-2.5 py-2">
                    {i === 0 ? "—" : formatTime(s.scheduledArrivalOffsetMin, train.originDeparture)}
                  </td>
                  <td className="border-b border-border px-2.5 py-2">{arrActual}</td>
                  <td className="border-b border-border px-2.5 py-2">
                    {s.scheduledDepartureOffsetMin == null ? "—" : formatTime(s.scheduledDepartureOffsetMin, train.originDeparture)}
                  </td>
                  <td className="border-b border-border px-2.5 py-2">{depActual}</td>
                  <td className="border-b border-border px-2.5 py-2">
                    <DelayPill label={arrDi.label} band={arrDi.band} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
