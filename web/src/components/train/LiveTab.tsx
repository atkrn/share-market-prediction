import LazyRailMap from "@/components/map/LazyRailMap";
import Card from "@/components/ui/Card";
import DelayPill from "@/components/ui/DelayPill";
import { delayInfo, formatTime } from "@/lib/format";
import type { Insight, LiveStatus, PredictionSet, StationEvent, TrainMeta } from "@/lib/types";

interface LiveTabProps {
  train: TrainMeta;
  liveStatus: LiveStatus;
  liveSchedule: StationEvent[];
  insights: Insight[];
  predictions: PredictionSet;
  active: boolean;
}

export default function LiveTab({ train, liveStatus, liveSchedule, insights, predictions, active }: LiveTabProps) {
  const currentSequence = train.route[train.liveRun.currentIndex]?.sequenceNumber ?? 0;
  const predictedNextName =
    train.route.find((s) => s.code === predictions.nextStation.stationCode)?.name ??
    predictions.nextStation.stationCode;
  const destinationName =
    train.route.find((s) => s.code === predictions.destination.stationCode)?.name ??
    predictions.destination.stationCode;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Card title="Live Map">
        <div className="h-[440px] overflow-hidden rounded-lg">
          <LazyRailMap
            route={train.route}
            marker={{
              lat: liveStatus.position.lat,
              lon: liveStatus.position.lon,
              headingDeg: liveStatus.position.headingDeg,
              label: `${train.trainNumber} · ${liveStatus.position.speedKmph} km/h`,
            }}
            passedSequence={currentSequence}
            active={active}
            initialView="focusMarker"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-3.5 text-xs text-text-dim">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" /> Train position
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#94a3b8]" /> Passed station
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-[#94a3b8]" /> Upcoming station
          </span>
        </div>
      </Card>

      <Card title="Route & Live Schedule">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["Station", "Sched Arr", "Actual/ETA", "Status"].map((h) => (
                <th key={h} className="border-b border-border px-2.5 py-2 text-left text-xs font-semibold uppercase text-text-dim">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {liveSchedule.map((s, i) => {
              const di = delayInfo(s.arrivalDelayMin, s.isPending && s.arrivalDelayMin == null);
              const actual =
                i === 0
                  ? "—"
                  : `${s.isPending ? "ETA " : ""}${formatTime(s.actualArrivalOffsetMin, train.originDeparture)}`;
              return (
                <tr key={s.stationCode} className={s.isCurrent ? "bg-brand/[0.08]" : ""}>
                  <td className="border-b border-border px-2.5 py-2">
                    {s.stationCode} {s.isCurrent && "📍"}
                  </td>
                  <td className="border-b border-border px-2.5 py-2">
                    {i === 0 ? "—" : formatTime(s.scheduledArrivalOffsetMin, train.originDeparture)}
                  </td>
                  <td className="border-b border-border px-2.5 py-2">{actual}</td>
                  <td className="border-b border-border px-2.5 py-2">
                    <DelayPill label={di.label} band={di.band} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {insights[0] && (
          <div className="mt-3 rounded-xl border border-brand/30 bg-gradient-to-br from-brand/[0.12] to-brand/[0.03] px-3.5 py-3 text-[13.5px]">
            <span className="mr-1.5">🤖</span>
            <b>AI Insight:</b> {insights[0].text}{" "}
            <span className="text-text-dim">(Confidence: {Math.round(insights[0].confidence * 100)}%)</span>
          </div>
        )}

        <div className="mt-3 rounded-xl border border-border bg-panel-2 px-3.5 py-3 text-[13.5px] leading-7">
          <b>Predicted ETA</b>
          <br />
          {predictedNextName} ({predictions.nextStation.stationCode}):{" "}
          <b>{formatTime(predictions.nextStation.predictedArrivalOffsetMin, train.originDeparture)}</b>{" "}
          <span className="text-text-dim">(+{predictions.nextStation.predictedDelayMinutes}m, {Math.round(predictions.nextStation.confidence * 100)}% confidence)</span>
          <br />
          {destinationName} ({predictions.destination.stationCode}):{" "}
          <b>{formatTime(predictions.destination.predictedArrivalOffsetMin, train.originDeparture)}</b>{" "}
          <span className="text-text-dim">(+{predictions.destination.predictedDelayMinutes}m, {Math.round(predictions.destination.confidence * 100)}% confidence)</span>
        </div>
      </Card>
    </div>
  );
}
