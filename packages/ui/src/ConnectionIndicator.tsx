import { DotIcon, RefreshIcon } from "./icons.js";

export interface ConnectionIndicatorProps {
  mode: "live" | "polling";
  pollingLabel?: string;
}

/** Whether updates arrive live or by polling, said in text (not shade). */
export function ConnectionIndicator({
  mode,
  pollingLabel = "Refreshing every 15 s",
}: ConnectionIndicatorProps) {
  return (
    <p role="status" className="bl-connection">
      {mode === "live" ? <DotIcon /> : <RefreshIcon />}
      {mode === "live" ? "Live" : pollingLabel}
    </p>
  );
}
