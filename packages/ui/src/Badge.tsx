// Badges always carry text; the icon and border style repeat the meaning
// without relying on shade (DESIGN_SYSTEM.md section 6). Labels come from
// @bookleaf/shared via the caller, so wording has one source.
import type { ComponentProps, ComponentType, ReactNode } from "react";
import { cx } from "./cx.js";
import {
  CheckIcon,
  ChevronUpIcon,
  ChevronsUpIcon,
  CircleDotIcon,
  CircleIcon,
  HalfCircleIcon,
  LockIcon,
  PersonIcon,
  type IconProps,
} from "./icons.js";

export type BadgeVariant = "default" | "muted" | "strong" | "inverse" | "plain" | "dashed";

export interface BadgeProps extends ComponentProps<"span"> {
  variant?: BadgeVariant;
  icon?: ReactNode;
}

export function Badge({ variant = "default", icon, className, children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={cx("bl-badge", variant !== "default" && `bl-badge--${variant}`, className)}>
      {icon}
      {children}
    </span>
  );
}

export type BadgeStatus = "open" | "in_progress" | "resolved" | "closed";

const STATUS_ICONS: Record<BadgeStatus, ComponentType<IconProps>> = {
  open: CircleIcon,
  in_progress: HalfCircleIcon,
  resolved: CheckIcon,
  closed: LockIcon,
};

export function StatusBadge({ status, label }: { status: BadgeStatus; label: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge variant={status === "closed" ? "muted" : "default"} icon={<Icon size={12} />}>
      {label}
    </Badge>
  );
}

export type BadgePriority = "critical" | "high" | "medium" | "low" | "untriaged";

const PRIORITY_STYLES: Record<BadgePriority, { variant: BadgeVariant; Icon?: ComponentType<IconProps> }> = {
  critical: { variant: "inverse", Icon: ChevronsUpIcon },
  high: { variant: "strong", Icon: ChevronUpIcon },
  medium: { variant: "default" },
  low: { variant: "plain" },
  untriaged: { variant: "dashed" },
};

export function PriorityBadge({ priority, label }: { priority: BadgePriority; label: string }) {
  const { variant, Icon } = PRIORITY_STYLES[priority];
  return (
    <Badge variant={variant} icon={Icon ? <Icon size={12} /> : undefined}>
      {label}
    </Badge>
  );
}

/** "AI suggestion · 82% confident" or "Set by admin". */
export function SourceTag({ source, label }: { source: "ai" | "admin"; label: string }) {
  const Icon = source === "ai" ? CircleDotIcon : PersonIcon;
  return (
    <Badge variant="muted" icon={<Icon size={12} />}>
      {label}
    </Badge>
  );
}
