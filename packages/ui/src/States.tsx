"use client";
// Empty, loading and error states (COMPONENTS.md, author/STATES.md).
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type HeadingLevel = 2 | 3;

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** A real link or button. */
  action?: ReactNode;
  headingLevel?: HeadingLevel;
}

export function EmptyState({ title, description, action, headingLevel = 2 }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="bl-state">
      <Heading className="bl-state__title">{title}</Heading>
      {description ? <p className="bl-state__description">{description}</p> : null}
      {action ? <div className="bl-state__actions">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ width = "100%", height }: { width?: string; height?: string }) {
  const style: CSSProperties = { width, height };
  return <span className="bl-skeleton" style={style} aria-hidden="true" />;
}

export interface LoadingStateProps {
  /** Read by screen readers instead of the placeholder shapes. */
  label?: string;
  lines?: number;
  children?: ReactNode;
}

const LINE_WIDTHS = ["100%", "92%", "80%", "96%", "70%"];

export function LoadingState({ label = "Loading…", lines = 3, children }: LoadingStateProps) {
  return (
    <div className="bl-skeleton-stack" aria-busy="true">
      <p className="bl-sr-only">{label}</p>
      {children ??
        Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} width={LINE_WIDTHS[index % LINE_WIDTHS.length]} />
        ))}
    </div>
  );
}

export interface ErrorStateProps {
  title: string;
  description?: ReactNode;
  /** Shown as "Reference: req_…" so support can find the request. */
  requestId?: string | null;
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions, e.g. a link back. */
  action?: ReactNode;
  headingLevel?: HeadingLevel;
}

/** Focus moves to the heading when it appears, so the failure is announced. */
export function ErrorState({
  title,
  description,
  requestId,
  onRetry,
  retryLabel = "Try again",
  action,
  headingLevel = 2,
}: ErrorStateProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="bl-state bl-state--error">
      <Heading ref={heading} tabIndex={-1} className="bl-state__title">
        {title}
      </Heading>
      {description ? <p className="bl-state__description">{description}</p> : null}
      {requestId ? (
        <p className="bl-state__reference">
          Reference: <span className="bl-mono">{requestId}</span>
        </p>
      ) : null}
      {onRetry || action ? (
        <div className="bl-state__actions">
          {onRetry ? (
            <button type="button" className="bl-button bl-button--secondary" onClick={onRetry}>
              {retryLabel}
            </button>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
