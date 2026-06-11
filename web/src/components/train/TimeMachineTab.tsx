"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import LazyRailMap from "@/components/map/LazyRailMap";
import StationTimeline from "@/components/train/StationTimeline";
import Card from "@/components/ui/Card";
import DelayPill from "@/components/ui/DelayPill";
import { delayInfo, formatDuration, formatTime, headingAtDistance, positionFromDistance } from "@/lib/format";
import { distanceAtTime, generateRunData } from "@/lib/timeMachine";
import type { RunSummary, TrainMeta } from "@/lib/types";

const SPEEDS = [1, 2, 4, 8];

interface TimeMachineTabProps {
  train: TrainMeta;
  runs: RunSummary[];
  active: boolean;
}

export default function TimeMachineTab({ train, runs, active }: TimeMachineTabProps) {
  const dates = useMemo(() => runs.map((r) => r.runDate), [runs]);
  const todayStr = dates[0];

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [playheadMin, setPlayheadMin] = useState(0);

  const [renderedDate, setRenderedDate] = useState(selectedDate);
  if (selectedDate !== renderedDate) {
    setRenderedDate(selectedDate);
    setPlayheadMin(0);
    setPlaying(false);
  }

  const run = useMemo(() => generateRunData(train, selectedDate, todayStr), [train, selectedDate, todayStr]);

  const lastFrameRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      lastFrameRef.current = null;
      return;
    }
    let raf: number;
    const tick = (ts: number) => {
      if (lastFrameRef.current == null) lastFrameRef.current = ts;
      const dtSec = (ts - lastFrameRef.current) / 1000;
      lastFrameRef.current = ts;
      // total journey plays in ~60s at 1x
      const ratePerSec = (run.totalDurationMin / 60) * speed;
      setPlayheadMin((prev) => {
        const next = prev + dtSec * ratePerSec;
        if (next >= run.totalDurationMin) {
          setPlaying(false);
          return run.totalDurationMin;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, run]);

  const distance = distanceAtTime(run.curve, playheadMin);
  const pos = positionFromDistance(train.route, distance);
  const heading = headingAtDistance(train.route, distance);

  let lastIdx = 0;
  for (let i = 0; i < run.stations.length; i++) {
    const arrT = i === 0 ? 0 : (run.stations[i].actualArrivalMin as number);
    if (playheadMin >= arrT) lastIdx = i;
    else break;
  }
  const lastStation = run.stations[lastIdx];
  const delay = lastIdx === 0 ? (lastStation.departureDelayMin ?? 0) : lastStation.arrivalDelayMin;
  const di = delayInfo(delay);

  const delaysSoFar = run.stations
    .slice(0, lastIdx + 1)
    .flatMap((st) => [st.arrivalDelayMin, st.departureDelayMin])
    .filter((d): d is number => d != null);
  const maxSoFar = delaysSoFar.length ? Math.max(...delaysSoFar) : 0;
  const recovered = maxSoFar - (delay ?? 0);

  const finalDi = delayInfo(run.finalDelayMin);

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    setPlaying(false);
    const frac = Number(e.target.value) / 1000;
    setPlayheadMin(frac * run.totalDurationMin);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
      <Card title="Replay Map">
        <div className="h-[440px] overflow-hidden rounded-lg">
          <LazyRailMap
            route={train.route}
            marker={{ lat: pos.lat, lon: pos.lon, headingDeg: heading, label: train.trainNumber }}
            passedSequence={lastStation.sequenceNumber}
            active={active}
            initialView="fitRoute"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <label className="text-text-dim">📅 Date:</label>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm text-text"
          >
            {dates.map((d, i) => (
              <option key={d} value={d}>
                {d}
                {i === 0 ? " (Today — Live)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="min-w-20 cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-bold text-[#03222f]"
          >
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round((playheadMin / run.totalDurationMin) * 1000)}
            onChange={handleScrub}
            className="flex-1 accent-(--color-brand)"
          />
          <div className="flex gap-1.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-xs ${
                  speed === s ? "border-brand text-brand" : "border-border text-text-dim"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        <StationTimeline run={run} playheadMin={playheadMin} />
      </Card>

      <Card title="Journey Summary">
        <div className="text-[13.5px] leading-7">
          Date: <b>{run.date}</b>{" "}
          {run.date === todayStr && <span className="text-text-dim">(today — live, in progress)</span>}
          <br />
          Total duration: <b>{formatDuration(run.totalDurationMin)}</b>{" "}
          <span className="text-text-dim">(scheduled {formatDuration(train.scheduledDurationMin)})</span>
          <br />
          Average speed: <b>{run.avgSpeedKmph} km/h</b>
          <br />
          Final delay: <DelayPill label={finalDi.label} band={finalDi.band} />
          <br />
          Max delay: <b className="text-delayed">+{run.maxDelayMin}m</b>
        </div>

        <h3 className="mb-2.5 mt-4 text-xs font-semibold uppercase tracking-wider text-text-dim">At Playhead</h3>
        <div className="text-[13.5px] leading-7">
          Time: <b>{formatTime(playheadMin, train.originDeparture)}</b>
          <br />
          Position:{" "}
          <b>
            {lastStation.name} ({lastStation.code})
          </b>
          <br />
          Distance covered: <b>{Math.round(distance)} km</b> / {train.totalDistanceKm} km
          <br />
          Delay at this point: <DelayPill label={di.label} band={di.band} />
          <br />
          {recovered > 0 && (
            <>
              Recovered <b className="text-early">{recovered}m</b> from peak delay so far
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            alert(
              "Export Clip — in production this renders a shareable GIF/clip of the replay (see §16.5 of the design docs)."
            )
          }
          className="mt-3 cursor-pointer rounded-lg border border-border bg-panel-2 px-3.5 py-2 text-sm"
        >
          📷 Export Clip
        </button>
      </Card>
    </div>
  );
}
