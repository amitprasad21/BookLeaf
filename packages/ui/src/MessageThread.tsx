import { cx } from "./cx.js";

export interface ThreadItem {
  id: string;
  sender: string;
  /** Machine-readable time for <time dateTime>. */
  dateTime: string;
  timeLabel: string;
  timeTitle?: string;
  body: string;
  /** The viewer's own message (the other party's get a strong left rule). */
  own: boolean;
}

/** Oldest first. Bodies are plain text: React escapes them and CSS keeps the line breaks. */
export function MessageThread({ items, label }: { items: readonly ThreadItem[]; label?: string }) {
  return (
    <ol className="bl-thread" aria-label={label}>
      {items.map((item) => (
        <li key={item.id} className={cx("bl-message", !item.own && "bl-message--other")}>
          <div className="bl-message__meta">
            <span className="bl-message__sender">{item.sender}</span>
            <time className="bl-message__time" dateTime={item.dateTime} title={item.timeTitle}>
              {item.timeLabel}
            </time>
          </div>
          <p className="bl-message__body">{item.body}</p>
        </li>
      ))}
    </ol>
  );
}
