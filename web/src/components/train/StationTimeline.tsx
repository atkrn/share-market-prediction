import type { Run } from "@/lib/types";

export default function StationTimeline({ run, playheadMin }: { run: Run; playheadMin: number }) {
  return (
    <div className="mt-4 flex items-center gap-0 overflow-x-auto pb-2">
      {run.stations.map((s, i) => {
        const arrTime = i === 0 ? 0 : (s.actualArrivalMin as number);
        let state: "passed" | "current" | "" = "";
        if (playheadMin > arrTime + 0.5) state = "passed";
        else if (
          Math.abs(playheadMin - arrTime) <= 0.5 ||
          (i === 0 && playheadMin < (run.stations[1].actualArrivalMin as number))
        ) {
          if (playheadMin >= arrTime - 0.001) state = "current";
        }

        return (
          <div key={s.code} className="relative flex min-w-16 flex-col items-center">
            {i > 0 && (
              <div
                className={`absolute left-[-50%] top-[6px] h-0.5 w-full ${
                  state ? "bg-brand" : "bg-border"
                }`}
              />
            )}
            <div
              className={`z-10 mb-1.5 rounded-full border-2 ${
                state === "passed"
                  ? "h-3.5 w-3.5 border-brand bg-brand"
                  : state === "current"
                    ? "h-[18px] w-[18px] border-ontime bg-ontime"
                    : "h-3.5 w-3.5 border-text-dim bg-panel"
              }`}
            />
            <div className={`text-[11px] ${state ? "font-semibold text-text" : "text-text-dim"}`}>{s.code}</div>
          </div>
        );
      })}
    </div>
  );
}
