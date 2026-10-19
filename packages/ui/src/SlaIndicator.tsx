import { cx } from "./cx.js";
import { ClockIcon } from "./icons.js";

export type SlaTone = "breached" | "due_soon" | "on_track" | "met" | "not_applicable";

/** First-response state, text first ("Overdue · 6 h"); breached is bold, never shade alone. */
export function SlaIndicator({ state, label }: { state: SlaTone; label: string }) {
  const urgent = state === "breached" || state === "due_soon";
  return (
    <span className={cx("bl-sla", state === "breached" && "bl-sla--breached", !urgent && "bl-muted")}>
      {urgent ? <ClockIcon size={14} /> : null}
      {label}
    </span>
  );
}
