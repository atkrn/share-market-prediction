"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Card from "@/components/ui/Card";
import Kpi from "@/components/ui/Kpi";
import { RELIABILITY_MAX_DEDUCTIONS } from "@/lib/data/analytics";
import type { AnalyticsSummary, ReliabilityComponents, ReliabilityScore } from "@/lib/types";

interface PerformanceTabProps {
  analytics: AnalyticsSummary;
  reliability: ReliabilityScore;
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RELIABILITY_LABELS: Record<keyof ReliabilityComponents, string> = {
  punctuality: "Punctuality",
  consistency: "Consistency",
  cancellations: "Cancellations",
  severeDelays: "Severe delays",
};

const TOOLTIP_STYLE = { background: "#1a2640", border: "1px solid #243352", borderRadius: 8, fontSize: 12 };
const AXIS_TICK = { fill: "#94a3b8", fontSize: 11 };

export default function PerformanceTab({ analytics, reliability }: PerformanceTabProps) {
  const trendData = analytics.delayTrend.map((v, i) => ({
    day: `-${analytics.delayTrend.length - i}d`,
    delay: v,
  }));
  const dowData = analytics.dayOfWeekAvgDelay.map((v, i) => ({ day: DOW_LABELS[i], delay: v }));

  const maxDelayedStation = Math.max(...analytics.mostDelayedStations.map((s) => s.avgMinutes), 1);
  const maxRecoveryStation = Math.max(...analytics.recoveryStations.map((s) => Math.abs(s.avgMinutes)), 1);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi value={`${reliability.score}/100`} label="Reliability Score" />
        <Kpi value={`${analytics.averageDelayMinutes} min`} label="Avg Delay (30d)" />
        <Kpi value={`${analytics.punctualityPct}%`} label="Punctuality (≤15m)" />
        <Kpi value={`${analytics.averageSpeedKmph} km/h`} label="Avg Speed" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Delay Trend (Last 30 Days)">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="delayTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#243352" vertical={false} />
                <XAxis dataKey="day" tick={AXIS_TICK} interval={3} axisLine={false} tickLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "Delay (min)", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e6edf7" }} />
                <Area type="monotone" dataKey="delay" stroke="#38bdf8" fill="url(#delayTrendFill)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Reliability Breakdown">
          <div
            className="relative mx-auto mb-2.5 flex h-[130px] w-[130px] items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--color-early) 0% ${reliability.score}%, var(--color-border) ${reliability.score}% 100%)`,
            }}
          >
            <div className="absolute inset-2.5 rounded-full bg-panel" />
            <div className="relative text-[28px] font-extrabold">
              {reliability.score}
              <small className="text-[13px] font-medium text-text-dim">/100</small>
            </div>
          </div>

          {(Object.keys(reliability.components) as Array<keyof ReliabilityComponents>).map((key) => {
            const value = reliability.components[key];
            const max = RELIABILITY_MAX_DEDUCTIONS[key];
            const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
            return (
              <div key={key} className="my-1.5 flex items-center gap-2 text-[12.5px]">
                <div className="w-[110px] text-text-dim">{RELIABILITY_LABELS[key]}</div>
                <div className="h-2 flex-1 overflow-hidden rounded bg-panel-2">
                  <span className="block h-full rounded bg-ontime" style={{ width: `${pct}%` }} />
                </div>
                <div className="w-9 text-right">{value > 0 ? `-${value}` : "0"}</div>
              </div>
            );
          })}

          <div className="mt-2 text-xs text-text-dim">
            Best month: {reliability.bestMonth.label} ({reliability.bestMonth.score}/100) · Worst month:{" "}
            {reliability.worstMonth.label} ({reliability.worstMonth.score}/100)
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Most Delayed / Recovery Stations">
          <b className="text-sm">Most Delayed Stations</b>
          {analytics.mostDelayedStations.map((s) => (
            <div key={s.stationCode} className="my-1.5 flex items-center gap-2 text-[12.5px]">
              <div className="w-[110px] truncate text-text-dim">{s.stationName}</div>
              <div className="h-2 flex-1 overflow-hidden rounded bg-panel-2">
                <span
                  className="block h-full rounded bg-delayed"
                  style={{ width: `${(s.avgMinutes / maxDelayedStation) * 100}%` }}
                />
              </div>
              <div className="w-9 text-right text-delayed">+{s.avgMinutes}m</div>
            </div>
          ))}

          <b className="mt-3.5 block text-sm">Recovery Stations</b>
          {analytics.recoveryStations.map((s) => (
            <div key={s.stationCode} className="my-1.5 flex items-center gap-2 text-[12.5px]">
              <div className="w-[110px] truncate text-text-dim">{s.stationName}</div>
              <div className="h-2 flex-1 overflow-hidden rounded bg-panel-2">
                <span
                  className="block h-full rounded bg-early"
                  style={{ width: `${(Math.abs(s.avgMinutes) / maxRecoveryStation) * 100}%` }}
                />
              </div>
              <div className="w-9 text-right text-early">{s.avgMinutes}m</div>
            </div>
          ))}
        </Card>

        <Card title="Day-of-Week Performance (avg delay, min)">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dowData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#243352" vertical={false} />
                <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#e6edf7" }} />
                <Bar dataKey="delay" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
