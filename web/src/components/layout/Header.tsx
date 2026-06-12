"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { searchTrains } from "@/lib/api";
import type { TrainSummary } from "@/lib/types";

export default function Header() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<TrainSummary[]>([]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchTrains(trimmed, 6).then((r) => {
        if (!cancelled) setResults(r);
      });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const visibleResults = query.trim() ? results : [];

  function go(trainNumber: string) {
    setQuery("");
    setFocused(false);
    router.push(`/trains/${trainNumber}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (visibleResults.length > 0) {
      go(visibleResults[0].trainNumber);
    } else if (/^\d{4,5}$/.test(query.trim())) {
      go(query.trim());
    }
  }

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-3.5">
      <Link href="/" className="flex items-center gap-2 text-xl font-bold">
        🚆 RailPulse
      </Link>
      <form onSubmit={handleSubmit} className="relative flex max-w-[480px] flex-1 gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search train number or name (e.g. 12951, Rajdhani)"
          className="flex-1 rounded-full border border-border bg-panel-2 px-3.5 py-2 text-sm text-text placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="submit"
          className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-[#03222f] cursor-pointer"
        >
          Track ▶
        </button>
        {focused && visibleResults.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-panel-2 shadow-lg">
            {visibleResults.map((t) => (
              <li key={t.trainNumber}>
                <button
                  type="button"
                  onMouseDown={() => go(t.trainNumber)}
                  className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm hover:bg-panel cursor-pointer"
                >
                  <span>
                    <span className="font-semibold">{t.trainNumber}</span> · {t.name}
                  </span>
                  <span className="text-xs text-text-dim">
                    {t.sourceStation} → {t.destinationStation}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>
      <div className="flex items-center gap-3.5 text-xs text-text-dim">
        <span className="cursor-pointer rounded-full border border-border px-2.5 py-1">EN | हिं</span>
        <span>👤 Login</span>
      </div>
    </header>
  );
}
