import type { ComponentType, ReactNode } from "react";
import { cx } from "./cx.js";
import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon, type IconProps } from "./icons.js";

export type NoticeTone = "info" | "warning" | "success" | "error";

const ICONS: Record<NoticeTone, ComponentType<IconProps>> = {
  info: InfoIcon,
  warning: WarningIcon,
  success: SuccessIcon,
  error: ErrorIcon,
};

export interface NoticeProps {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** Announce the notice: errors as alerts, the rest politely. Off for static notes. */
  announce?: boolean;
  className?: string;
  id?: string;
}

export function Notice({
  tone = "info",
  title,
  children,
  actions,
  announce = true,
  className,
  id,
}: NoticeProps) {
  const Icon = ICONS[tone];
  const role = announce ? (tone === "error" ? "alert" : "status") : undefined;
  return (
    <div id={id} role={role} className={cx("bl-notice", `bl-notice--${tone}`, className)}>
      <Icon className="bl-notice__icon" />
      <div className="bl-notice__content">
        {title ? <p className="bl-notice__title">{title}</p> : null}
        {children ? <div className="bl-notice__body">{children}</div> : null}
        {actions ? <div className="bl-notice__actions">{actions}</div> : null}
      </div>
    </div>
  );
}
