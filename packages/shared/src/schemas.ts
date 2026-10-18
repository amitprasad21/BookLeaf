// Request schemas shared by the backend (authoritative validation) and the
// frontends (same rules for inline form errors). Limits mirror openapi.yaml and
// INTEGRATION_CONTRACT.md section 10; the database checks repeat them.
import { z } from "zod";
import {
  AiStatusSchema,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketCategorySchema,
  TicketStatusSchema,
} from "./enums.js";

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

const splitList = (value: unknown) =>
  typeof value === "string"
    ? [
        ...new Set(
          value
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
        ),
      ]
    : value;

/** Comma-separated list of enum values, e.g. "open,in_progress". Blanks and duplicates are dropped. */
function commaList<T extends z.ZodType>(item: T, max: number) {
  return z.preprocess(splitList, z.array(item).max(max));
}

const StatusListSchema = commaList(TicketStatusSchema, TICKET_STATUSES.length);

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

export const QUEUE_SORTS = ["urgency", "created_at", "-created_at", "-updated_at"] as const;
export const ASSIGNEE_FILTERS = ["me", "unassigned", "any"] as const;
/** Priority filter values: the four priorities plus tickets not triaged yet. */
export const QueuePriorityFilterSchema = z.enum([...TICKET_PRIORITIES, "untriaged"]);
export const QUEUE_SEARCH_MAX = 100;

// Queue search keeps letters, digits, spaces and - ' . & / #. Anything else
// becomes a space, so the text can never change the shape of the database
// filter it is placed in (no commas, parentheses, quotes, backslashes or wildcards).
const SEARCH_DISALLOWED = /[^\p{L}\p{N} \-'.&/#]/gu;

export function normalizeQueueSearch(value: string): string {
  return value.replace(SEARCH_DISALLOWED, " ").replace(/\s+/g, " ").trim();
}

/** GET /admin/tickets query. Unknown query params are ignored. */
export const AdminTicketQueueQuerySchema = PageQuerySchema.extend({
  status: StatusListSchema.optional(),
  category: commaList(TicketCategorySchema, TICKET_CATEGORIES.length).optional(),
  priority: commaList(QueuePriorityFilterSchema, TICKET_PRIORITIES.length + 1).optional(),
  assignee: z.enum(ASSIGNEE_FILTERS).default("any"),
  aiStatus: AiStatusSchema.optional(),
  /** Only "true": unresolved, no first reply, past the first-response target. */
  overdue: z
    .literal("true")
    .transform(() => true as const)
    .optional(),
  createdFrom: z.iso.date().optional(),
  createdTo: z.iso.date().optional(),
  q: z
    .string()
    .trim()
    .max(QUEUE_SEARCH_MAX)
    .transform((value) => normalizeQueueSearch(value) || undefined)
    .optional(),
  sort: z.enum(QUEUE_SORTS).default("urgency"),
}).refine((query) => !query.createdFrom || !query.createdTo || query.createdFrom <= query.createdTo, {
  path: ["createdTo"],
  message: "must be on or after createdFrom",
});
export type AdminTicketQueueQuery = z.infer<typeof AdminTicketQueueQuerySchema>;
