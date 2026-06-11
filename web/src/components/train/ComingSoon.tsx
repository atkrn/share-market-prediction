import Link from "next/link";
import Card from "@/components/ui/Card";
import type { TrainSummary } from "@/lib/types";

export default function ComingSoon({ summary }: { summary: TrainSummary }) {
  return (
    <div className="px-5 py-8">
      <Card title="Coming Soon" className="mx-auto max-w-xl text-center">
        <h1 className="text-xl font-bold">
          {summary.trainNumber} · {summary.name}
        </h1>
        <p className="mt-2 text-sm text-text-dim">
          {summary.sourceStation} → {summary.destinationStation}
        </p>
        <p className="mt-4 text-[13.5px] leading-6 text-text-dim">
          Live tracking, schedules, and analytics for this train are being rolled out as part of our
          phased coverage of the top 500 trains. Check back soon — or track one of the trains
          already live below.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg border border-border bg-panel-2 px-3.5 py-2 text-sm text-text"
        >
          ← Back to home
        </Link>
      </Card>
    </div>
  );
}
