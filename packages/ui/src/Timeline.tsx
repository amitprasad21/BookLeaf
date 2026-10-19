import type { ReactNode } from "react";

export interface TimelineItem {
  id: string;
  text: ReactNode;
  actor?: string | null;
  dateTime: string;
  timeLabel: string;
}

/** Ordered list of what happened, each with who and when. */
export function Timeline({ items, label }: { items: readonly TimelineItem[]; label?: string }) {
  return (
    <ol className="bl-timeline" aria-label={label}>
      {items.map((item) => (
        <li key={item.id} className="bl-timeline__item">
          <p className="bl-timeline__text">{item.text}</p>
          <p className="bl-timeline__meta">
            {item.actor ? `${item.actor} · ` : null}
            <time dateTime={item.dateTime}>{item.timeLabel}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}
