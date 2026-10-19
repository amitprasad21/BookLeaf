import type { Metadata } from "next";
import { Suspense } from "react";
import { NewTicketScreen } from "@/features/tickets/NewTicketScreen";

export const metadata: Metadata = { title: "Raise a query" };

export default function NewTicketPage() {
  // ?bookId pre-selects the book (useSearchParams needs Suspense).
  return (
    <Suspense fallback={null}>
      <NewTicketScreen />
    </Suspense>
  );
}
