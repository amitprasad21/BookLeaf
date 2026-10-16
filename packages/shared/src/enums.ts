// Contract enums. Values must match openapi.yaml (components/schemas) and the
// Postgres enums in .back/DATA_MODEL.md. Change the contract first.
import { z } from "zod";

export const ROLES = ["author", "admin"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
export const TICKET_CATEGORIES = [
  "royalty_payments",
  "isbn_metadata",
  "printing_quality",
  "distribution_availability",
  "book_status_production",
  "general_inquiry",
] as const;
export const TICKET_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const AI_STATUSES = ["pending", "completed", "failed", "manual_review_required"] as const;
export const VALUE_SOURCES = ["ai", "admin"] as const;

export const RoleSchema = z.enum(ROLES);
export const TicketStatusSchema = z.enum(TICKET_STATUSES);
export const TicketCategorySchema = z.enum(TICKET_CATEGORIES);
export const TicketPrioritySchema = z.enum(TICKET_PRIORITIES);
export const AiStatusSchema = z.enum(AI_STATUSES);
export const ValueSourceSchema = z.enum(VALUE_SOURCES);

export type Role = z.infer<typeof RoleSchema>;
export type TicketStatus = z.infer<typeof TicketStatusSchema>;
export type TicketCategory = z.infer<typeof TicketCategorySchema>;
export type TicketPriority = z.infer<typeof TicketPrioritySchema>;
export type AiStatus = z.infer<typeof AiStatusSchema>;
export type ValueSource = z.infer<typeof ValueSourceSchema>;
