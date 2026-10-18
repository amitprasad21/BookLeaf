// Request schemas shared by the backend (authoritative validation) and the
// frontends (same rules for inline form errors). Limits mirror openapi.yaml and
// INTEGRATION_CONTRACT.md section 10; the database checks repeat them.
import { z } from "zod";
import { TICKET_STATUSES, TicketStatusSchema } from "./enums.js";

export const TICKET_LIMITS = {
  subject: { min: 5, max: 150 },
  description: { min: 20, max: 5000 },
  attachmentName: { max: 255 },
  messageBody: { min: 1, max: 5000 },
} as const;

export const ATTACHMENT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".pdf"] as const;

export const BookIdSchema = z.string().regex(/^BK\d{3,}$/, "must be a book id like BK001");

/** POST /author/tickets. Strict: unknown fields such as authorId or priority are rejected. */
export const CreateTicketRequestSchema = z.strictObject({
  bookId: BookIdSchema.nullable(),
  subject: z.string().trim().min(TICKET_LIMITS.subject.min).max(TICKET_LIMITS.subject.max),
  description: z.string().trim().min(TICKET_LIMITS.description.min).max(TICKET_LIMITS.description.max),
  attachmentName: z
    .string()
    .trim()
    .max(TICKET_LIMITS.attachmentName.max)
    .refine((name) => ATTACHMENT_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)), {
      message: `must end in ${ATTACHMENT_EXTENSIONS.join(", ")}`,
    })
    .nullable()
    .optional(),
});
export type CreateTicketRequest = z.infer<typeof CreateTicketRequestSchema>;

/** Comma-separated status filter, e.g. "open,in_progress". */
const StatusListSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean),
  )
  .pipe(z.array(TicketStatusSchema).max(TICKET_STATUSES.length));

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /author/tickets query. Unknown query params are ignored (e.g. cache-busters). */
export const AuthorTicketListQuerySchema = PageQuerySchema.extend({
  status: StatusListSchema.optional(),
});
export type AuthorTicketListQuery = z.infer<typeof AuthorTicketListQuerySchema>;

export const TicketIdParamsSchema = z.object({ ticketId: z.uuid() });
