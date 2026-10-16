import type { ReactNode } from "react";

type HeadingLevel = 1 | 2 | 3;

export interface PanelProps {
  title: string;
  /** Heading level is passed in so each page keeps a correct outline. */
  headingLevel?: HeadingLevel;
  children?: ReactNode;
}

const panelStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: "var(--radius-panel)",
  padding: "var(--space-5)",
} as const;

const headingStyle = {
  margin: "0 0 var(--space-3)",
  fontSize: "var(--text-lg)",
  lineHeight: "var(--leading-lg)",
  fontWeight: 600,
} as const;

export function Panel({ title, headingLevel = 2, children }: PanelProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <section style={panelStyle}>
      <Heading style={headingStyle}>{title}</Heading>
      {children}
    </section>
  );
}
