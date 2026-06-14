"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import LiveTab from "@/components/train/LiveTab";
import PerformanceTab from "@/components/train/PerformanceTab";
import ScheduleTab from "@/components/train/ScheduleTab";
import StatusBar from "@/components/train/StatusBar";
import TimeMachineTab from "@/components/train/TimeMachineTab";
import TrainHeaderCard from "@/components/train/TrainHeaderCard";
import type {
  AnalyticsSummary,
  Insight,
  LiveStatus,
  PredictionSet,
  ReliabilityScore,
  RunSummary,
  StationEvent,
  TrainMeta,
} from "@/lib/types";

const TABS = [
  { id: "live", label: "Live" },
  { id: "schedule", label: "Schedule" },
  { id: "timemachine", label: "History / Time Machine" },
  { id: "performance", label: "Performance" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface TrainDashboardProps {
  train: TrainMeta;
  liveStatus: LiveStatus;
  liveSchedule: StationEvent[];
  insights: Insight[];
  predictions: PredictionSet;
  runs: RunSummary[];
  analytics: AnalyticsSummary;
  reliability: ReliabilityScore;
}

export default function TrainDashboard({
  train,
  liveStatus,
  liveSchedule,
  insights,
  predictions,
  runs,
  analytics,
  reliability,
}: TrainDashboardProps) {
  const router = useRouter();
  const [active, setActive] = useState<TabId>("live");
  const [visited, setVisited] = useState<Set<TabId>>(new Set(["live"]));

  // Today's live position/delay/schedule are simulated server-side from
  // wall-clock time, so periodically re-fetching keeps the Live and
  // Schedule tabs moving without a manual page reload.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(id);
  }, [router]);

  function selectTab(tab: TabId) {
    setActive(tab);
    setVisited((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }

  return (
    <div>
      <TrainHeaderCard train={train} />
      <StatusBar liveStatus={liveStatus} />

      <nav className="mt-3.5 flex gap-1 overflow-x-auto border-b border-border px-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={`cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-sm ${
              active === tab.id ? "border-brand font-semibold text-brand" : "border-transparent text-text-dim hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="px-5 py-4 pb-10">
        <div className={active === "live" ? "" : "hidden"}>
          {visited.has("live") && (
            <LiveTab
              train={train}
              liveStatus={liveStatus}
              liveSchedule={liveSchedule}
              insights={insights}
              predictions={predictions}
              active={active === "live"}
            />
          )}
        </div>
        <div className={active === "schedule" ? "" : "hidden"}>
          {visited.has("schedule") && <ScheduleTab train={train} liveStatus={liveStatus} liveSchedule={liveSchedule} />}
        </div>
        <div className={active === "timemachine" ? "" : "hidden"}>
          {visited.has("timemachine") && <TimeMachineTab train={train} runs={runs} active={active === "timemachine"} />}
        </div>
        <div className={active === "performance" ? "" : "hidden"}>
          {visited.has("performance") && <PerformanceTab analytics={analytics} reliability={reliability} />}
        </div>
      </main>
    </div>
  );
}
