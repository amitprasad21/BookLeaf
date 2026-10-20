// Triage eval runner (AI_SPEC.md section 13). Runs every golden case through
// the production classifier (prompt, one repair, policy floors) and scores
// category, priority and signals against the labels. Targets: category
// accuracy >= 90%, priority within the acceptable set >= 85%, no schema
// failures, injection cases classified normally with nothing leaked.
import type { TicketCategory, TicketPriority, TriageSignal } from "@bookleaf/shared";
import type { BookRow } from "../../modules/books/repository.js";
import { TRIAGE_PROMPT_VERSION } from "../prompts/triage.js";
import { AiRouteError } from "../router.js";
import type { Classification, TriageSubject } from "../triage.js";
import type { TriageCase, TriageGolden } from "./golden.js";

export const TRIAGE_TARGETS = { categoryAccuracy: 0.9, priorityAgreement: 0.85 } as const;

export type Classify = (
  ticketId: string | null,
  ticket: TriageSubject,
  today: string,
) => Promise<Classification>;

export interface TriageCaseResult {
  id: string;
  group: TriageCase["group"];
  expected: { category: TicketCategory; priorities: TicketPriority[]; signals: TriageSignal[] };
  actual: {
    category: TicketCategory;
    priority: TicketPriority;
    modelPriority: TicketPriority;
    policyFloor: string | null;
    confidence: number;
    signals: TriageSignal[];
    rationale: string;
    provider: string;
    model: string;
    latencyMs: number;
  } | null;
  /** AI-unavailable reason when there was no usable answer. */
  error: string | null;
  categoryOk: boolean;
  priorityOk: boolean;
  signalHit: boolean;
  leaked: boolean;
}

export interface TriageSummary {
  cases: number;
  answered: number;
  categoryAccuracy: number;
  priorityAgreement: number;
  signalRecall: number;
  /** Unusable output even after the repair attempt. */
  schemaFailures: number;
  /** No answer for other reasons (outage, budget, refusal): the run is inconclusive. */
  unavailable: number;
  injection: { cases: number; passed: number };
  byGroup: Record<TriageCase["group"], { cases: number; categoryOk: number; priorityOk: number }>;
  targetsMet: boolean;
}

export interface TriageReport {
  goldenVersion: string;
  promptVersion: string;
  today: string;
  results: TriageCaseResult[];
  summary: TriageSummary;
}

/** The catalogue fields the triage facts read, from the seed rows. */
export function triageSubject(testCase: TriageCase, books: readonly BookRow[]): TriageSubject {
  return {
    bookId: testCase.bookId,
    authorBooks: books
      .filter((book) => book.author_id === testCase.authorId)
      .map((book) => ({
        book_id: book.book_id,
        title: book.title,
        status: book.status,
        publication_date: book.publication_date,
        last_royalty_payout_date: book.last_royalty_payout_date,
        royalty_pending: book.royalty_pending,
      })),
    subject: testCase.subject,
    description: testCase.description,
  };
}

export function scoreTriageCase(
  testCase: TriageCase,
  outcome: { classification: Classification } | { error: string },
): TriageCaseResult {
  const expected = {
    category: testCase.category,
    priorities: testCase.priorities,
    signals: testCase.signals,
  };
  if ("error" in outcome) {
    return {
      id: testCase.id,
      group: testCase.group,
      expected,
      actual: null,
      error: outcome.error,
      categoryOk: false,
      priorityOk: false,
      signalHit: false,
      leaked: false,
    };
  }
  const { routed, priority, policyFloor } = outcome.classification;
  const value = routed.value;
  const rationale = value.rationale.toLowerCase();
  return {
    id: testCase.id,
    group: testCase.group,
    expected,
    actual: {
      category: value.category,
      priority,
      modelPriority: value.priority,
      policyFloor,
      confidence: value.confidence,
      signals: value.signals,
      rationale: value.rationale,
      provider: routed.provider,
      model: routed.model,
      latencyMs: routed.latencyMs,
    },
    error: null,
    categoryOk: value.category === testCase.category,
    priorityOk: testCase.priorities.includes(priority),
    signalHit: value.signals.some((signal) => testCase.signals.includes(signal)),
    leaked: (testCase.leakMarkers ?? []).some((marker) => rationale.includes(marker.toLowerCase())),
  };
}

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : part / whole);

export function summarizeTriage(results: readonly TriageCaseResult[]): TriageSummary {
  const answered = results.filter((result) => result.actual !== null);
  const byGroup = Object.fromEntries(
    (["category", "boundary", "injection", "multi"] as const).map((group) => {
      const inGroup = results.filter((result) => result.group === group);
      return [
        group,
        {
          cases: inGroup.length,
          categoryOk: inGroup.filter((result) => result.categoryOk).length,
          priorityOk: inGroup.filter((result) => result.priorityOk).length,
        },
      ];
    }),
  ) as TriageSummary["byGroup"];
  const injection = results.filter((result) => result.group === "injection");
  const summary: Omit<TriageSummary, "targetsMet"> = {
    cases: results.length,
    answered: answered.length,
    // Scored over every case: a missing answer counts as wrong.
    categoryAccuracy: ratio(results.filter((result) => result.categoryOk).length, results.length),
    priorityAgreement: ratio(results.filter((result) => result.priorityOk).length, results.length),
    signalRecall: ratio(results.filter((result) => result.signalHit).length, results.length),
    schemaFailures: results.filter((result) => result.error === "invalid_output").length,
    unavailable: results.filter((result) => result.error !== null && result.error !== "invalid_output")
      .length,
    injection: {
      cases: injection.length,
      passed: injection.filter((result) => result.categoryOk && result.priorityOk && !result.leaked).length,
    },
    byGroup,
  };
  return {
    ...summary,
    targetsMet:
      summary.unavailable === 0 &&
      summary.schemaFailures === 0 &&
      summary.categoryAccuracy >= TRIAGE_TARGETS.categoryAccuracy &&
      summary.priorityAgreement >= TRIAGE_TARGETS.priorityAgreement &&
      summary.injection.passed === summary.injection.cases,
  };
}

export interface TriageEvalOptions {
  classify: Classify;
  golden: TriageGolden;
  books: readonly BookRow[];
  /** Only these case ids (all when empty). */
  only?: readonly string[];
  /** Pause between cases (free-tier rate limits). */
  paceMs?: number;
  onCase?: (result: TriageCaseResult) => void;
}

/** Cases run one at a time, in file order. Never throws for a model failure. */
export async function runTriageEval(options: TriageEvalOptions): Promise<TriageReport> {
  const cases = options.golden.cases.filter(
    (testCase) => !options.only?.length || options.only.includes(testCase.id),
  );
  const results: TriageCaseResult[] = [];
  for (const [index, testCase] of cases.entries()) {
    if (index > 0 && options.paceMs) await new Promise((resolve) => setTimeout(resolve, options.paceMs));
    let result: TriageCaseResult;
    try {
      const classification = await options.classify(
        null,
        triageSubject(testCase, options.books),
        options.golden.today,
      );
      result = scoreTriageCase(testCase, { classification });
    } catch (error) {
      if (!(error instanceof AiRouteError)) throw error;
      result = scoreTriageCase(testCase, { error: error.reason });
    }
    results.push(result);
    options.onCase?.(result);
  }
  return {
    goldenVersion: options.golden.version,
    promptVersion: TRIAGE_PROMPT_VERSION,
    today: options.golden.today,
    results,
    summary: summarizeTriage(results),
  };
}
