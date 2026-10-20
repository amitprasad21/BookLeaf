// Draft eval runner (AI_SPEC.md section 13). Runs the assignment's sample
// queries through the production draft service (KB sections, facts, prompt,
// guards, sign-off, fact warnings) with an in-memory store, then applies the
// rubric checks. A person still reads every reply: the checks are a first pass.
import { randomUUID } from "node:crypto";
import type { AuthorSummary } from "../../auth/types.js";
import type { BookRow } from "../../modules/books/repository.js";
import type { AdminTicketRow, AiDraftRow } from "../../modules/tickets/admin-repository.js";
import { DRAFT_PROMPT_VERSION } from "../prompts/draft.js";
import { AiRouteError } from "../router.js";
import type { DraftService, DraftStore } from "../drafts.js";
import type { DraftCase, DraftCases } from "./golden.js";

export interface CheckResult {
  name: string;
  ok: boolean;
}

export interface DraftCaseResult {
  id: string;
  guidance: string;
  reply: string | null;
  error: string | null;
  checks: CheckResult[];
  factWarnings: string[];
  kbSectionsUsed: string[];
  escalation: { needed: boolean; team: string } | null;
  missingInformation: string[];
  internalChecklist: string[];
  model: string | null;
}

export interface DraftReport {
  casesVersion: string;
  promptVersion: string;
  today: string;
  results: DraftCaseResult[];
  summary: {
    cases: number;
    answered: number;
    checksPassed: number;
    checksTotal: number;
    /** Every check passed. */
    casesPassed: number;
    withFactWarnings: number;
  };
}

/** The reply opens by acknowledging the author (rubric: "acknowledges first"). */
const ACKNOWLEDGES =
  /thank|sorry|apolog|understand|frustrat|appreciate|reaching out|glad you asked|great question/i;

/** The first 400 characters after the greeting, whether or not the greeting has its own line. */
export function openingOf(reply: string): string {
  return reply
    .replace(/^\s*(dear|hi|hello)\s+[^,\n]+,\s*/i, "")
    .trim()
    .slice(0, 400);
}

export function scoreDraft(testCase: DraftCase, draft: AiDraftRow): CheckResult[] {
  const reply = draft.reply;
  const checks: CheckResult[] = [
    { name: "acknowledges the author first", ok: ACKNOWLEDGES.test(openingOf(reply)) },
    ...testCase.checks.map((check) => {
      const found = new RegExp(check.pattern, "i").test(reply);
      return { name: check.name, ok: check.mustNot ? !found : found };
    }),
    { name: "no fact-guard warnings", ok: draft.fact_warnings.length === 0 },
  ];
  if (testCase.escalation) {
    const { needed, team } = testCase.escalation;
    checks.push({
      name: needed ? `escalates to ${team}` : "no escalation",
      ok: draft.needs_escalation === needed && (!needed || draft.escalation_team === team),
    });
  }
  return checks;
}

/** One ticket, its author and their books, as the draft service reads them. */
export function draftStore(
  testCase: DraftCase,
  author: AuthorSummary,
  books: readonly BookRow[],
): { store: DraftStore; ticketId: string } {
  const ticketId = randomUUID();
  const authorBooks = books.filter((book) => book.author_id === testCase.authorId);
  const book = authorBooks.find((candidate) => candidate.book_id === testCase.bookId) ?? null;
  const ticket = {
    id: ticketId,
    reference: "BL-EVAL",
    subject: testCase.subject,
    description: testCase.description,
    status: "open",
    category: testCase.category,
    category_source: "admin",
    priority: testCase.priority,
    priority_source: "admin",
    ai_status: "completed",
    ai_category: testCase.category,
    ai_priority: testCase.priority,
    ai_signals: [],
    author: {
      author_id: author.authorId,
      name: author.name,
      city: author.city,
      joined_date: author.joinedDate,
    },
    book: book ? { book_id: book.book_id, title: book.title } : null,
  } as unknown as AdminTicketRow;

  const store: DraftStore = {
    findDetail: async (id) =>
      id === ticketId ? { ticket, books: authorBooks, messages: [], notes: [], timeline: [] } : null,
    findReadyDraft: async () => null,
    insertDraft: async (draft) => ({
      ...draft,
      id: randomUUID(),
      status: "ready",
      created_at: new Date().toISOString(),
    }),
    supersedeOtherDrafts: async () => {},
    countAuditEvents: async () => 0,
  };
  return { store, ticketId };
}

export interface DraftEvalOptions {
  drafts: DraftService;
  cases: DraftCases;
  authors: readonly AuthorSummary[];
  books: readonly BookRow[];
  only?: readonly string[];
  paceMs?: number;
  onCase?: (result: DraftCaseResult) => void;
}

export async function runDraftEval(options: DraftEvalOptions): Promise<DraftReport> {
  const cases = options.cases.cases.filter(
    (testCase) => !options.only?.length || options.only.includes(testCase.id),
  );
  const results: DraftCaseResult[] = [];
  for (const [index, testCase] of cases.entries()) {
    if (index > 0 && options.paceMs) await new Promise((resolve) => setTimeout(resolve, options.paceMs));
    const author = options.authors.find((candidate) => candidate.authorId === testCase.authorId);
    if (!author) throw new Error(`draft case ${testCase.id}: unknown author ${testCase.authorId}`);
    const { store, ticketId } = draftStore(testCase, author, options.books);
    let result: DraftCaseResult;
    try {
      const { draft } = await options.drafts.getOrCreate({
        store,
        ticketId,
        adminId: "eval",
        regenerate: false,
      });
      result = {
        id: testCase.id,
        guidance: testCase.guidance,
        reply: draft.reply,
        error: null,
        checks: scoreDraft(testCase, draft),
        factWarnings: draft.fact_warnings,
        kbSectionsUsed: draft.kb_sections_used,
        escalation: draft.needs_escalation ? { needed: true, team: draft.escalation_team } : null,
        missingInformation: draft.missing_information,
        internalChecklist: draft.internal_checklist,
        model: draft.model,
      };
    } catch (error) {
      if (!(error instanceof AiRouteError)) throw error;
      result = {
        id: testCase.id,
        guidance: testCase.guidance,
        reply: null,
        error: error.reason,
        checks: [],
        factWarnings: [],
        kbSectionsUsed: [],
        escalation: null,
        missingInformation: [],
        internalChecklist: [],
        model: null,
      };
    }
    results.push(result);
    options.onCase?.(result);
  }

  return draftReport(options.cases, DRAFT_PROMPT_VERSION, results);
}

function draftReport(cases: DraftCases, promptVersion: string, results: DraftCaseResult[]): DraftReport {
  const checks = results.flatMap((result) => result.checks);
  return {
    casesVersion: cases.version,
    promptVersion,
    today: cases.today,
    results,
    summary: {
      cases: results.length,
      answered: results.filter((result) => result.reply !== null).length,
      checksPassed: checks.filter((check) => check.ok).length,
      checksTotal: checks.length,
      casesPassed: results.filter(
        (result) => result.reply !== null && result.checks.every((check) => check.ok),
      ).length,
      withFactWarnings: results.filter((result) => result.factWarnings.length > 0).length,
    },
  };
}

/**
 * Re-applies the current checks to the replies in a saved report (no model
 * calls), e.g. after a rubric pattern was too strict. The replies and the
 * prompt version stay those of the original run.
 */
export function rescoreDraftReport(saved: DraftReport, cases: DraftCases): DraftReport {
  const results = saved.results.map((result) => {
    const testCase = cases.cases.find((candidate) => candidate.id === result.id);
    if (!testCase || result.reply === null) return result;
    const draft = {
      reply: result.reply,
      fact_warnings: result.factWarnings,
      needs_escalation: result.escalation?.needed ?? false,
      escalation_team: result.escalation?.team ?? "none",
    } as AiDraftRow;
    return { ...result, checks: scoreDraft(testCase, draft) };
  });
  return draftReport(cases, saved.promptVersion, results);
}
