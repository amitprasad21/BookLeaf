import type { ReactNode } from "react";

/** A description list of headline figures (royalty summary). */
export function KeyFigures({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <dl className="bl-keyfigures" aria-label={label}>
      {children}
    </dl>
  );
}

export interface KeyFigureProps {
  label: ReactNode;
  /** null shows `nullLabel`; unknown values are never shown as zero. */
  value: ReactNode | null;
  nullLabel?: string;
  caption?: ReactNode;
}

export function KeyFigure({ label, value, nullLabel = "Not available", caption }: KeyFigureProps) {
  return (
    <div className="bl-keyfigure">
      <dt className="bl-keyfigure__label">{label}</dt>
      <dd className="bl-keyfigure__value">{value ?? nullLabel}</dd>
      {caption ? <dd className="bl-keyfigure__caption">{caption}</dd> : null}
    </div>
  );
}
