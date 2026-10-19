// Raise a query: client-side checks with the same schema the API uses
// (packages/shared), friendly copy per field, and server errors mapped back
// onto fields (author/FLOWS.md F-A3).
import {
  ATTACHMENT_EXTENSIONS,
  CreateTicketRequestSchema,
  TICKET_LIMITS,
  type CreateTicketRequest,
  type ErrorDetail,
} from "@bookleaf/shared";

export const GENERAL = "general";
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ATTACHMENT_ERROR = "Please choose a JPG, PNG or PDF under 5 MB.";

export type QueryField = "about" | "subject" | "description" | "attachment";
export type FieldErrors = Partial<Record<QueryField, string>>;

/** Order used for the error summary and for focusing the first invalid field. */
export const FIELD_ORDER: readonly QueryField[] = ["about", "subject", "description", "attachment"];

export interface QueryDraft {
  /** A book id, GENERAL, or "" when nothing is chosen yet. */
  about: string;
  subject: string;
  description: string;
}

const MESSAGES: Record<QueryField, { tooShort: string; tooLong: string; other: string }> = {
  about: {
    tooShort: "Choose a book or General / Account Level.",
    tooLong: "Choose a book or General / Account Level.",
    other: "Choose one of your books or General / Account Level.",
  },
  subject: {
    tooShort: `Add a subject of at least ${TICKET_LIMITS.subject.min} characters.`,
    tooLong: `Keep the subject to ${TICKET_LIMITS.subject.max} characters or fewer.`,
    other: "Check the subject.",
  },
  description: {
    tooShort: `Please describe your query in at least ${TICKET_LIMITS.description.min} characters.`,
    tooLong: `Keep the description to ${TICKET_LIMITS.description.max.toLocaleString("en-IN")} characters or fewer.`,
    other: "Check the description.",
  },
  attachment: { tooShort: ATTACHMENT_ERROR, tooLong: ATTACHMENT_ERROR, other: ATTACHMENT_ERROR },
};

const FIELD_FOR_PATH: Record<string, QueryField> = {
  bookId: "about",
  subject: "subject",
  description: "description",
  attachmentName: "attachment",
};

function messageFor(field: QueryField, code: string | undefined): string {
  if (code === "too_small") return MESSAGES[field].tooShort;
  if (code === "too_big") return MESSAGES[field].tooLong;
  return MESSAGES[field].other;
}

export function attachmentProblem(file: { name: string; size: number }): string | null {
  const name = file.name.toLowerCase();
  const allowed = ATTACHMENT_EXTENSIONS.some((extension) => name.endsWith(extension));
  return allowed && file.size <= MAX_ATTACHMENT_BYTES ? null : ATTACHMENT_ERROR;
}

export type Validated = { ok: true; request: CreateTicketRequest } | { ok: false; errors: FieldErrors };

export function validateQuery(draft: QueryDraft, attachmentName: string | null): Validated {
  const errors: FieldErrors = {};
  if (draft.about === "") errors.about = MESSAGES.about.tooShort;
  const parsed = CreateTicketRequestSchema.safeParse({
    bookId: draft.about === GENERAL || draft.about === "" ? null : draft.about,
    subject: draft.subject,
    description: draft.description,
    attachmentName,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = FIELD_FOR_PATH[String(issue.path[0])];
      if (field && !errors[field]) errors[field] = messageFor(field, issue.code);
    }
  }
  if (Object.keys(errors).length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, request: parsed.data };
}

/** VALIDATION_FAILED details from the API, by field (unknown paths are ignored). */
export function serverFieldErrors(details: readonly ErrorDetail[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const detail of details) {
    const field = detail.path ? FIELD_FOR_PATH[detail.path] : undefined;
    if (!field || errors[field]) continue;
    const issue = detail.issue.toLowerCase();
    const code = /at least|too small|>=/.test(issue)
      ? "too_small"
      : /at most|too big|<=/.test(issue)
        ? "too_big"
        : undefined;
    errors[field] = messageFor(field, code);
  }
  return errors;
}

/** "Please try again in 4 minutes." from Retry-After seconds. */
export function retryAfterText(seconds: number | null): string {
  if (!seconds) return "Please try again in a few minutes.";
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

// Unsent text survives errors, reloads and a session expiry (F-A5).
const DRAFT_KEY = "bookleaf.author.queryDraft";

export function loadDraft(): QueryDraft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<QueryDraft>;
    return {
      about: typeof value.about === "string" ? value.about : "",
      subject: typeof value.subject === "string" ? value.subject : "",
      description: typeof value.description === "string" ? value.description : "",
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: QueryDraft) {
  try {
    if (!draft.subject && !draft.description) window.sessionStorage.removeItem(DRAFT_KEY);
    else window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage can be unavailable (private mode); the form still works.
  }
}

export function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
