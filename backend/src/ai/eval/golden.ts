// Golden sets for the AI evals (AI_SPEC.md section 13): the triage golden set
// and the draft review set, validated on load so a typo in a label fails
// loudly instead of skewing the scores.
import { readFileSync } from "node:fs";
import {
  EscalationTeamSchema,
  TicketCategorySchema,
  TicketPrioritySchema,
  TriageSignalSchema,
} from "@bookleaf/shared";
import { z } from "zod";

const BookId = z.string().regex(/^BK\d{3}$/);
const AuthorId = z.string().regex(/^AUTH\d{3}$/);

export const TRIAGE_GROUPS = ["category", "boundary", "injection", "multi"] as const;

export const TriageCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  group: z.enum(TRIAGE_GROUPS),
  authorId: AuthorId,
  bookId: BookId.nullable(),
  subject: z.string().min(5).max(150),
  description: z.string().min(20).max(5000),
  category: TicketCategorySchema,
  /** Acceptable priorities. */
  priorities: z.array(TicketPrioritySchema).min(1),
  /** At least one of these signals should appear. */
  signals: z.array(TriageSignalSchema).min(1),
  /** Injection cases: text that must not appear in the rationale. */
  leakMarkers: z.array(z.string()).optional(),
});
export type TriageCase = z.infer<typeof TriageCaseSchema>;

export const TriageGoldenSchema = z.strictObject({
  version: z.string(),
  /** Fixed business date, so the facts (payout calendar, overdue flags) don't drift. */
  today: z.iso.date(),
  notes: z.string(),
  cases: z.array(TriageCaseSchema).min(1),
});
export type TriageGolden = z.infer<typeof TriageGoldenSchema>;

export const DraftCheckSchema = z.strictObject({
  name: z.string(),
  /** Case-insensitive regular expression. */
  pattern: z.string(),
  mustNot: z.boolean().optional(),
});
export type DraftCheck = z.infer<typeof DraftCheckSchema>;

export const DraftCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/),
  authorId: AuthorId,
  bookId: BookId.nullable(),
  category: TicketCategorySchema,
  priority: TicketPrioritySchema,
  subject: z.string().min(5).max(150),
  description: z.string().min(20).max(5000),
  /** The assignment's expected response, for the person reviewing the output. */
  guidance: z.string(),
  checks: z.array(DraftCheckSchema),
  escalation: z.strictObject({ needed: z.boolean(), team: EscalationTeamSchema }).optional(),
});
export type DraftCase = z.infer<typeof DraftCaseSchema>;

export const DraftCasesSchema = z.strictObject({
  version: z.string(),
  today: z.iso.date(),
  notes: z.string(),
  cases: z.array(DraftCaseSchema).min(1),
});
export type DraftCases = z.infer<typeof DraftCasesSchema>;

const readJson = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"));

export const loadTriageGolden = (): TriageGolden => TriageGoldenSchema.parse(readJson("triage-golden.json"));
export const loadDraftCases = (): DraftCases => DraftCasesSchema.parse(readJson("draft-cases.json"));
