// User-facing labels. Category labels are the exact wording from the assignment.
import type { TicketCategory, TicketPriority, TicketStatus } from "./enums.js";

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  royalty_payments: "Royalty & Payments",
  isbn_metadata: "ISBN & Metadata Issues",
  printing_quality: "Printing & Quality",
  distribution_availability: "Distribution & Availability",
  book_status_production: "Book Status & Production Updates",
  general_inquiry: "General Inquiry",
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const UNTRIAGED_LABEL = "Needs triage";
