import type { Metadata } from "next";
import { TicketScreen } from "@/features/ticket/TicketScreen";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  return <TicketScreen ticketId={ticketId} />;
}
