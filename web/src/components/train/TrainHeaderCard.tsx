import { formatRunsOnDays } from "@/lib/format";
import type { TrainMeta } from "@/lib/types";

export default function TrainHeaderCard({ train }: { train: TrainMeta }) {
  const origin = train.route[0];
  const destination = train.route[train.route.length - 1];

  return (
    <div className="px-5 pt-3.5">
      <h1 className="text-xl font-bold">
        {train.trainNumber} · {train.name}
        {train.nameLocal && <span className="ml-2 text-base font-normal text-text-dim">{train.nameLocal}</span>}
      </h1>
      <div className="mt-0.5 text-sm text-text-dim">
        {origin.name} ({origin.code}) → {destination.name} ({destination.code}) ·{" "}
        {train.totalDistanceKm.toLocaleString()} km · {formatRunsOnDays(train.runsOnDays)}
      </div>
    </div>
  );
}
