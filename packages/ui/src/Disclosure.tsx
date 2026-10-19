import type { ReactNode } from "react";
import { cx } from "./cx.js";
import { ChevronDownIcon } from "./icons.js";

/** Native details/summary: keyboard and screen-reader support come for free. */
export function Disclosure({
  summary,
  className,
  children,
}: {
  summary: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={cx("bl-disclosure", className)}>
      <summary>
        {summary}
        <ChevronDownIcon />
      </summary>
      {children}
    </details>
  );
}
