import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { cx } from "./cx.js";
import { SpinnerIcon } from "./icons.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "default" | "small";

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Button classes for links that look like buttons (e.g. next/link). */
export function buttonClassName({ variant = "secondary", size = "default", className }: ButtonStyle = {}) {
  return cx("bl-button", `bl-button--${variant}`, size === "small" && "bl-button--small", className);
}

export interface ButtonProps extends ComponentProps<"button">, ButtonStyle {
  icon?: ReactNode;
  /** Busy: shows a spinner, ignores clicks (including form submits) and keeps its width and focus. */
  loading?: boolean;
  loadingLabel?: string;
}

const ignoreClick = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

export function Button({
  variant,
  size,
  className,
  icon,
  loading = false,
  loadingLabel,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={buttonClassName({ variant, size, className })}
      aria-busy={loading || undefined}
      aria-disabled={loading || rest["aria-disabled"] || undefined}
      onClick={loading ? ignoreClick : onClick}
    >
      <span className="bl-button__stack">
        <span data-hidden={loading} aria-hidden={loading || undefined}>
          {icon}
          {children}
        </span>
        <span data-hidden={!loading} aria-hidden={!loading || undefined}>
          <SpinnerIcon />
          {loadingLabel ?? children}
        </span>
      </span>
    </button>
  );
}
