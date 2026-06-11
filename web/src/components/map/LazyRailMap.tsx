"use client";

import dynamic from "next/dynamic";

const LazyRailMap = dynamic(() => import("./RailMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-text-dim">Loading map…</div>
  ),
});

export default LazyRailMap;
