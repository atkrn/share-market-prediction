"use client";

import { useEffect, useState } from "react";
import DelayPill from "@/components/ui/DelayPill";
import { delayInfo } from "@/lib/format";
import type { LiveStatus } from "@/lib/types";

const SOURCE_LABELS: Record<LiveStatus["dataFreshness"]["source"], string> = {
  crowd_gps: "crowd GPS",
  ntes_scrape: "NTES scrape",
  official_feed: "official feed",
  interpolated: "interpolated",
};

export default function StatusBar({ liveStatus }: { liveStatus: LiveStatus }) {
  const [secondsAgo, setSecondsAgo] = useState(liveStatus.dataFreshness.stalenessSeconds);

  useEffect(() => {
    const id = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (liveStatus.status !== "running") {
    return (
      <div className="mx-5 mt-3 flex flex-wrap items-center gap-6 rounded-xl border border-border bg-panel px-4 py-2.5 text-sm">
        <DelayPill label={liveStatus.status.replace("_", " ")} band="pending" />
      </div>
    );
  }

  const cur = liveStatus.delay.currentMinutes;
  const di = delayInfo(cur);
  const icon = di.band === "delayed" ? "🔴" : di.band === "early" ? "🟢" : "🟡";
  const text = cur === 0 ? "On Time" : cur < 0 ? `${Math.abs(cur)} min Early` : `Delayed ${cur} min`;

  return (
    <div className="mx-5 mt-3 flex flex-wrap items-center gap-6 rounded-xl border border-border bg-panel px-4 py-2.5 text-sm">
      <DelayPill label={`${icon} ${text}`} band={di.band} />
      <span className="text-text-dim">
        Last updated <b className="text-text">{secondsAgo}s</b> ago ({SOURCE_LABELS[liveStatus.dataFreshness.source]})
      </span>
      <span>
        Speed <b>{liveStatus.position.speedKmph} km/h</b>
      </span>
      <span className="text-text-dim">
        Max delay today: <b className="text-delayed">{liveStatus.delay.maxTodayMinutes}m</b>
      </span>
    </div>
  );
}
