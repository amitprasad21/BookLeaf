import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@bookleaf/ui/tokens.css";

export const metadata: Metadata = {
  title: "BookLeaf Author Portal",
  description: "Your books, royalties and support conversations with BookLeaf Publishing.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
