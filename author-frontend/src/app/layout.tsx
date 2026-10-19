import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@bookleaf/ui/tokens.css";
import "@bookleaf/ui/components.css";
import { AppProviders } from "@/providers/AppProviders";

export const metadata: Metadata = {
  title: { default: "BookLeaf Author Portal", template: "%s · BookLeaf Author Portal" },
  description: "Your books, royalties and support conversations with BookLeaf Publishing.",
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
