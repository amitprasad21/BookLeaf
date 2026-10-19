import type { ReactNode } from "react";
import { PortalShell } from "@/features/session/PortalShell";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
