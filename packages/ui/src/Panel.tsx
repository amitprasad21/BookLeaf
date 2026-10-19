import type { ReactNode } from "react";
import { cx } from "./cx.js";

type HeadingLevel = 1 | 2 | 3;

export interface PanelProps {
  title: string;
  /** Heading level is passed in so each page keeps a correct outline. */
  headingLevel?: HeadingLevel;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export function Panel({ title, headingLevel = 2, actions, className, children }: PanelProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section className={cx("bl-panel", className)}>
      <div className="bl-panel__header">
        <Heading className="bl-panel__title">{title}</Heading>
        {actions}
      </div>
      {children}
    </section>
  );
}
