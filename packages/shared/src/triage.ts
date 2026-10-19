// AI triage output contract (AI_SPEC.md sections 4-6). One combined call
// returns the category, priority, confidence, signals and a short rationale
// for the admin. Every field is required (Groq strict mode); limits are
// checked here after parsing, whatever the provider enforced.
import { z } from "zod";
import { TicketCategorySchema, TicketPrioritySchema } from "./enums.js";

export const TRIAGE_SIGNALS = [
  "payment_missing",
  "payment_overdue",
  "payment_amount_query",
  "bank_details",
  "isbn_error",
  "metadata_change",
  "print_defect",
  "listing_unavailable",
  "listing_delay",
  "production_delay",
  "approval_pending",
  "legal_or_rights",
  "account_access",
  "time_sensitive_event",
  "repeat_contact",
  "informational",
] as const;
export const TriageSignalSchema = z.enum(TRIAGE_SIGNALS);
export type TriageSignal = z.infer<typeof TriageSignalSchema>;

export const TRIAGE_LIMITS = { maxSignals: 5, rationale: { min: 10, max: 300 } } as const;

export const TriageResultSchema = z.strictObject({
  category: TicketCategorySchema,
  priority: TicketPrioritySchema,
  confidence: z.number().min(0).max(1).describe("Probability (0-1) that the category is correct"),
  signals: z
    .array(TriageSignalSchema)
    .max(TRIAGE_LIMITS.maxSignals)
    .describe(`Up to ${TRIAGE_LIMITS.maxSignals} signals that apply`),
  rationale: z
    .string()
    .trim()
    .min(TRIAGE_LIMITS.rationale.min)
    .max(TRIAGE_LIMITS.rationale.max)
    .describe("One or two sentences for the admin naming the decisive detail"),
});
export type TriageResult = z.infer<typeof TriageResultSchema>;

/** Confidence below this shows "Low confidence: check category" in the admin UI. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;
