import Link from "next/link";
import { getPopularTrains } from "@/lib/api";

export default async function HomePage() {
  const trains = await getPopularTrains();

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-bold">Track any Indian Railways train, live.</h1>
      <p className="mt-2 text-text-dim">
        Real-time position, schedule vs. actual performance, delay analytics, and the{" "}
        <span className="text-brand">Train Time Machine</span> — replay any past journey.
      </p>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-text-dim">Popular trains</h2>
      <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-panel">
        {trains.map((t) => (
          <li key={t.trainNumber}>
            <Link
              href={`/trains/${t.trainNumber}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-panel-2"
            >
              <span>
                <span className="font-semibold">{t.trainNumber}</span> · {t.name}
                {t.nameLocal && <span className="ml-2 text-text-dim">{t.nameLocal}</span>}
              </span>
              <span className="text-sm text-text-dim">
                {t.sourceStation} → {t.destinationStation}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
