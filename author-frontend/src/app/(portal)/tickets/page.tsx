import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketsScreen } from "@/features/tickets/TicketsScreen";

export const metadata: Metadata = { title: "My Tickets" };

export default function TicketsPage() {
  // The status filter lives in the query string (useSearchParams needs Suspense).
  return (
    <Suspense fallback={null}>
      <TicketsScreen />
    </Suspense>
  );
}
