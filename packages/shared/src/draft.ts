// AI reply draft contract (AI_SPEC.md section 9). The model's output uses
// snake_case keys (as specified); the API returns the camelCase AiDraft DTO.
// Every field is required (provider strict modes); limits are checked here.
import { z } from "zod";

export const ESCALATION_TEAMS = [
  "none",
  "finance",
  "production",
  "distribution",
  "printing",
  "support_lead",
] as const;
export const EscalationTeamSchema = z.enum(ESCALATION_TEAMS);
export type EscalationTeam = z.infer<typeof EscalationTeamSchema>;

export const DRAFT_LIMITS = {
  reply: { min: 300, max: 2500 },
  maxListItems: 5,
  listItem: { max: 200 },
} as const;

const ListItem = z.string().trim().min(1).max(DRAFT_LIMITS.listItem.max);

export const DraftResultSchema = z.strictObject({
  reply: z
    .string()
    .trim()
    .min(DRAFT_LIMITS.reply.min)
    .max(DRAFT_LIMITS.reply.max)
    .describe("The complete reply to the author, plain text, ready for the admin to review"),
  kb_sections_used: z.array(z.string()).describe("IDs of the knowledge base sections the reply relies on"),
  needs_escalation: z.boolean(),
  escalation_team: EscalationTeamSchema,
  internal_checklist: z
    .array(ListItem)
    .max(DRAFT_LIMITS.maxListItems)
    .describe("Admin-only actions to take before or after sending"),
  missing_information: z
    .array(ListItem)
    .max(DRAFT_LIMITS.maxListItems)
    .describe("Facts the admin must confirm or fill in before sending"),
});
export type DraftResult = z.infer<typeof DraftResultSchema>;

/** POST /admin/tickets/{ticketId}/draft (the body is optional). */
export const DraftRequestSchema = z.strictObject({ regenerate: z.boolean().default(false) });
