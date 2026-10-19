import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@bookleaf/ui/tokens.css";
import "@bookleaf/ui/components.css";
import { AppProviders } from "@/providers/AppProviders";

export const metadata: Metadata = {
  title: { default: "BookLeaf Support Console", template: "%s · BookLeaf Support Console" },
  description: "Ticket queue and triage for the BookLeaf operations team.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
