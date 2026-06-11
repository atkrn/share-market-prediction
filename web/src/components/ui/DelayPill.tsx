import type { DelayBand } from "@/lib/format";

const BAND_CLASSES: Record<DelayBand, string> = {
  early: "bg-early/15 text-early",
  ontime: "bg-ontime/15 text-ontime",
  delayed: "bg-delayed/15 text-delayed",
  pending: "bg-text-dim/10 text-text-dim",
};

export default function DelayPill({ label, band }: { label: string; band: DelayBand }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${BAND_CLASSES[band]}`}>
      {label}
    </span>
  );
}
