export default function Kpi({
  value,
  label,
  valueClassName = "",
}: {
  value: string;
  label: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel p-3.5 text-center">
      <div className={`text-2xl font-bold ${valueClassName}`}>{value}</div>
      <div className="mt-1 text-xs text-text-dim">{label}</div>
    </div>
  );
}
