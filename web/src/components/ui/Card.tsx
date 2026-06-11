import type { ReactNode } from "react";

export default function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-panel p-3.5 ${className}`}>
      {title && (
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-text-dim">{title}</h3>
      )}
      {children}
    </div>
  );
}
