// Inline SVG icons on a 16 x 16 grid (no icon dependency, DESIGN_SYSTEM.md
// section 6). Decorative by default (aria-hidden): text always carries the
// meaning. Pass `title` only for an icon that stands alone.
import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  size?: number;
  title?: string;
}

function createIcon(name: string, shapes: ReactNode) {
  function Icon({ size = 16, title, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        {...rest}
      >
        {title ? <title>{title}</title> : null}
        {shapes}
      </svg>
    );
  }
  Icon.displayName = name;
  return Icon;
}

const solid = { fill: "currentColor", stroke: "none" } as const;

// Ticket status
export const CircleIcon = createIcon("CircleIcon", <circle cx="8" cy="8" r="5.5" />);
export const HalfCircleIcon = createIcon(
  "HalfCircleIcon",
  <>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 2.5a5.5 5.5 0 0 1 0 11z" {...solid} />
  </>,
);
export const CheckIcon = createIcon("CheckIcon", <path d="M3 8.5l3 3 7-7" />);
export const LockIcon = createIcon(
  "LockIcon",
  <>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </>,
);

// Priority
export const ChevronUpIcon = createIcon("ChevronUpIcon", <path d="M4 10l4-4 4 4" />);
export const ChevronsUpIcon = createIcon("ChevronsUpIcon", <path d="M4 8l4-4 4 4M4 12.5l4-4 4 4" />);
export const ChevronDownIcon = createIcon("ChevronDownIcon", <path d="M4 6l4 4 4-4" />);

// SLA, source and live updates
export const ClockIcon = createIcon(
  "ClockIcon",
  <>
    <circle cx="8" cy="8" r="5.5" />
    <path d="M8 5v3l2 1.5" />
  </>,
);
export const DotIcon = createIcon("DotIcon", <circle cx="8" cy="8" r="3" {...solid} />);
export const CircleDotIcon = createIcon(
  "CircleDotIcon",
  <>
    <circle cx="8" cy="8" r="5.5" />
    <circle cx="8" cy="8" r="1.5" {...solid} />
  </>,
);
export const PersonIcon = createIcon(
  "PersonIcon",
  <>
    <circle cx="8" cy="5.5" r="2.5" />
    <path d="M3 13.5c.8-2.5 2.7-3.5 5-3.5s4.2 1 5 3.5" />
  </>,
);

// Notices
export const InfoIcon = createIcon(
  "InfoIcon",
  <>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M8 7.5V11M8 5h.01" />
  </>,
);
export const WarningIcon = createIcon(
  "WarningIcon",
  <>
    <path d="M8 2l6.5 11.5h-13z" />
    <path d="M8 6.5v3M8 11.5h.01" />
  </>,
);
export const ErrorIcon = createIcon(
  "ErrorIcon",
  <>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M5.75 5.75l4.5 4.5M10.25 5.75l-4.5 4.5" />
  </>,
);
export const SuccessIcon = createIcon(
  "SuccessIcon",
  <>
    <circle cx="8" cy="8" r="6.5" />
    <path d="M5 8.25l2 2 4-4" />
  </>,
);

// Actions
export const ArrowLeftIcon = createIcon("ArrowLeftIcon", <path d="M13 8H3M7 4L3 8l4 4" />);
export const PlusIcon = createIcon("PlusIcon", <path d="M8 3v10M3 8h10" />);
export const RefreshIcon = createIcon("RefreshIcon", <path d="M13 8a5 5 0 1 1-1.46-3.54M13 2.5V5h-2.5" />);
export const SignOutIcon = createIcon(
  "SignOutIcon",
  <path d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11l3-3-3-3M13.5 8H6" />,
);
export const PaperclipIcon = createIcon(
  "PaperclipIcon",
  <path d="M12.5 7.5l-4.6 4.6a3 3 0 0 1-4.24-4.24l5.3-5.3a2 2 0 0 1 2.83 2.83L6.5 10.7a1 1 0 0 1-1.42-1.42L9.5 4.9" />,
);

/** Rotating arc; static when the user prefers reduced motion (tokens.css). */
export function SpinnerIcon({ size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      focusable="false"
      aria-hidden
      className={className ? `bl-spin ${className}` : "bl-spin"}
      {...rest}
    >
      <path d="M14 8a6 6 0 1 1-6-6" />
    </svg>
  );
}
