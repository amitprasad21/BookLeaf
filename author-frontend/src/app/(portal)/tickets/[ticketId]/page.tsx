import type { Metadata } from "next";
import { Suspense } from "react";
import { TicketDetailScreen } from "@/features/tickets/TicketDetailScreen";

export const metadata: Metadata = { title: "Query details" };

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return (
    <Suspense fallback={null}>
      <TicketDetailScreen ticketId={ticketId} />
    </Suspense>
  );
}
