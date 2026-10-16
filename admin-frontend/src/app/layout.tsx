import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@bookleaf/ui/tokens.css";

export const metadata: Metadata = {
  title: "BookLeaf Support Console",
  description: "Ticket queue and triage for the BookLeaf operations team.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
