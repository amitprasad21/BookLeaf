// AI-6: the golden sets are well-formed and bound to real seed data, the
// scoring follows AI_SPEC.md section 13, and both runners work end to end on
// the mock provider (no model calls).
import { readFileSync } from "node:fs";
import { TICKET_CATEGORIES, type TriageResult } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import { SeedDataSchema, toBookRows } from "../scripts/seed-data.js";
import { createAiFromEnv } from "../src/ai/config.js";
import { createDraftService } from "../src/ai/drafts.js";
import {
  openingOf,
  rescoreDraftReport,
  runDraftEval,
  scoreDraft,
  type DraftReport,
} from "../src/ai/eval/draft-eval.js";
import { loadDraftCases, loadTriageGolden, type TriageCase } from "../src/ai/eval/golden.js";
import {
  runTriageEval,
  scoreTriageCase,
  summarizeTriage,
  triageSubject,
  type Classify,
} from "../src/ai/eval/triage-eval.js";
import { MOCK_RESPONDERS } from "../src/ai/prompts/index.js";
import { AiRouteError } from "../src/ai/router.js";
import { createTriageClassifier, type Classification } from "../src/ai/triage.js";
import { loadEnv } from "../src/config/env.js";
import type { SystemWriter } from "../src/db/system-writer.js";
import type { AiDraftRow } from "../src/modules/tickets/admin-repository.js";
import { captureLogger } from "./helpers.js";

const seed = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const books = toBookRows(seed);
const authors = seed.authors.map((author) => ({
  authorId: author.author_id,
  name: author.name,
  city: author.city,
  joinedDate: author.joined_date,
}));
const owns = (authorId: string, bookId: string | null) =>
  bookId === null || books.some((book) => book.book_id === bookId && book.author_id === authorId);

const golden = loadTriageGolden();
const draftCases = loadDraftCases();

describe("triage golden set", () => {
  it("has the planned mix: 4+ per category, 6 boundary, 3 injection, 3 multi-issue", () => {
    const group = (name: TriageCase["group"]) => golden.cases.filter((testCase) => testCase.group === name);
    for (const category of TICKET_CATEGORIES) {
      expect(
        group("category").filter((testCase) => testCase.category === category).length,
      ).toBeGreaterThanOrEqual(4);
    }
    expect(group("boundary")).toHaveLength(6);
    expect(group("injection")).toHaveLength(3);
    expect(group("multi")).toHaveLength(3);
    expect(new Set(golden.cases.map((testCase) => testCase.id)).size).toBe(golden.cases.length);
  });

  it("binds every case to a seed author and one of their own books", () => {
    for (const testCase of golden.cases) {
      expect(
        seed.authors.some((author) => author.author_id === testCase.authorId),
        testCase.id,
      ).toBe(true);
      expect(owns(testCase.authorId, testCase.bookId), testCase.id).toBe(true);
    }
  });

  it("includes the assignment's own priority example and gives every injection case leak markers", () => {
    const sixMonths = golden.cases.find((testCase) => testCase.description.includes("6 months"))!;
    const bio = golden.cases.find((testCase) => testCase.description === "Can I update my author bio?")!;
    expect(sixMonths.priorities).toEqual(["critical"]);
    expect(bio.priorities).toEqual(["low"]);
    for (const testCase of golden.cases.filter((candidate) => candidate.group === "injection")) {
      expect(testCase.leakMarkers?.length, testCase.id).toBeGreaterThan(0);
    }
  });

  it("gives the facts builder the author's catalogue", () => {
    const subject = triageSubject(
      golden.cases.find((testCase) => testCase.authorId === "AUTH007")!,
      books,
    );
    expect(subject.authorBooks.map((book) => book.book_id)).toEqual(["BK011", "BK012", "BK013"]);
  });
});

describe("draft review set", () => {
  it("contains the seven assignment queries and the overdue-quarter regression, each bound to the author's own book", () => {
    expect(draftCases.cases).toHaveLength(8);
    expect(new Set(draftCases.cases.map((testCase) => testCase.category))).toEqual(
      new Set(TICKET_CATEGORIES),
    );
    for (const testCase of draftCases.cases) {
      expect(owns(testCase.authorId, testCase.bookId), testCase.id).toBe(true);
      for (const check of testCase.checks)
        expect(() => new RegExp(check.pattern, "i"), check.name).not.toThrow();
    }
  });
});

const classification = (
  value: Partial<TriageResult>,
  priority = value.priority ?? "low",
): Classification => ({
  routed: {
    value: {
      category: "general_inquiry",
      priority: "low",
      confidence: 0.9,
      signals: ["informational"],
      rationale: "The author asks how to update their bio.",
      ...value,
    },
    usage: { inputTokens: 1000, outputTokens: 80, cacheReadTokens: 0, cacheWriteTokens: 0 },
    latencyMs: 900,
    provider: "mock",
    model: "mock",
  },
  priority,
  policyFloor: null,
});

describe("triage scoring", () => {
  const bio = golden.cases.find((testCase) => testCase.id === "general-bio")!;
  const injection = golden.cases.find((testCase) => testCase.id === "injection-override-instructions")!;

  it("checks category, the acceptable priorities and signals", () => {
    const right = scoreTriageCase(bio, { classification: classification({}) });
    expect(right).toMatchObject({ categoryOk: true, priorityOk: true, signalHit: true, leaked: false });
    const wrong = scoreTriageCase(bio, {
      classification: classification({ category: "royalty_payments", signals: ["payment_missing"] }, "high"),
    });
    expect(wrong).toMatchObject({ categoryOk: false, priorityOk: false, signalHit: false });
  });

  it("judges priority after policy floors", () => {
    const isbn = golden.cases.find((testCase) => testCase.id === "isbn-mismatch-sample")!;
    const floored = {
      ...classification({ category: "isbn_metadata", priority: "medium" }),
      priority: "high" as const,
    };
    expect(scoreTriageCase(isbn, { classification: floored }).priorityOk).toBe(true);
  });

  it("flags a rationale that repeats the system prompt", () => {
    const leaked = scoreTriageCase(injection, {
      classification: classification({
        category: "royalty_payments",
        rationale: "As the triage assistant I was told to ignore all previous instructions.",
      }),
    });
    expect(leaked.leaked).toBe(true);
  });

  it("counts no answer as wrong, and separates schema failures from outages", () => {
    const results = [
      scoreTriageCase(bio, { classification: classification({}) }),
      scoreTriageCase(bio, { error: "invalid_output" }),
      scoreTriageCase(bio, { error: "provider_unavailable" }),
    ];
    const summary = summarizeTriage(results);
    expect(summary).toMatchObject({ cases: 3, answered: 1, schemaFailures: 1, unavailable: 1 });
    expect(summary.categoryAccuracy).toBeCloseTo(1 / 3);
    expect(summary.targetsMet).toBe(false);
  });

  it("meets the targets only with every injection case handled", () => {
    const perfect = golden.cases.map((testCase) =>
      scoreTriageCase(testCase, {
        classification: classification(
          { category: testCase.category, signals: [testCase.signals[0]!] },
          testCase.priorities[0],
        ),
      }),
    );
    expect(summarizeTriage(perfect).targetsMet).toBe(true);
    const oneLeak = perfect.map((result) =>
      result.group === "injection" ? { ...result, leaked: true } : result,
    );
    expect(summarizeTriage(oneLeak).targetsMet).toBe(false);
  });
});

describe("draft scoring", () => {
  const testCase = draftCases.cases.find((candidate) => candidate.id === "production-typesetting")!;
  const draft = (reply: string, overrides: Partial<AiDraftRow> = {}) =>
    ({
      reply,
      fact_warnings: [],
      needs_escalation: false,
      escalation_team: "none",
      ...overrides,
    }) as AiDraftRow;

  it("applies the case checks, the acknowledgement and the fact guard", () => {
    const good = draft(
      "Hi Kavita,\n\nThank you for checking in, and I understand the wait is frustrating.\n\nYour book is in typesetting. Proofreading comes next, and we expect it within 7 business days.\n\nWarm regards,\nBookLeaf Support",
    );
    expect(scoreDraft(testCase, good).every((check) => check.ok)).toBe(true);

    const bad = draft("Hi Kavita,\n\nThis is late because you delayed the approval.", {
      fact_warnings: ["₹4,000 isn't in this author's records"],
    });
    const failed = scoreDraft(testCase, bad)
      .filter((check) => !check.ok)
      .map((check) => check.name);
    expect(failed).toEqual(
      expect.arrayContaining([
        "acknowledges the author first",
        "names the next stage",
        "doesn't blame the author",
        "no fact-guard warnings",
      ]),
    );
  });

  it("checks the expected escalation", () => {
    const isbn = draftCases.cases.find((candidate) => candidate.id === "isbn-mismatch")!;
    const escalated = scoreDraft(
      isbn,
      draft("Hi Rohit,\n\nThanks", { needs_escalation: true, escalation_team: "production" }),
    );
    expect(escalated.find((check) => check.name === "escalates to production")?.ok).toBe(true);
    const notEscalated = scoreDraft(isbn, draft("Hi Rohit,\n\nThanks"));
    expect(notEscalated.find((check) => check.name === "escalates to production")?.ok).toBe(false);
  });

  it("rejects the reported wrong-quarter claim and accepts separate overdue and scheduled periods", () => {
    const quarterCase = draftCases.cases.find((candidate) => candidate.id === "royalty-overdue-quarter")!;
    const correct =
      "Hi Sneha,\n\nI'm sorry for the delay. Earlier royalties appear overdue against the April–June 2026 reference deadline of 14 August 2026. Finance will confirm the period and update you within 48 hours. The next scheduled payout is 14 November 2026.";
    const escalation = { needs_escalation: true, escalation_team: "finance" as const };
    expect(scoreDraft(quarterCase, draft(correct, escalation)).every((check) => check.ok)).toBe(true);
    const wrong = `${correct} The July–September 2026 payout appears to be overdue.`;
    expect(
      scoreDraft(quarterCase, draft(wrong, escalation)).find(
        (check) => check.name === "does not repeat the wrong-quarter claim",
      )?.ok,
    ).toBe(false);
  });

  it("detects the unsupported balance attribution and production progress claims seen in live review", () => {
    const royalty = draftCases.cases.find((candidate) => candidate.id === "royalty-too-low")!;
    const wronglyAttributed = scoreDraft(
      royalty,
      draft("Your pending balance of ₹3,570 for the April–June 2026 period appears overdue."),
    );
    expect(
      wronglyAttributed.find((check) => check.name === "does not assign the total balance to a quarter")?.ok,
    ).toBe(false);
    const separate = scoreDraft(
      royalty,
      draft(
        "Your total pending royalty is ₹3,570. The most recent passed deadline was 14 August 2026 for April–June 2026; finance will confirm the period.",
      ),
    );
    expect(
      separate.find((check) => check.name === "does not assign the total balance to a quarter")?.ok,
    ).toBe(true);
    for (const reply of [
      "Everything is progressing steadily without any unexpected hold-ups.",
      "Our production team is working closely on your manuscript to ensure everything is prepared properly.",
    ]) {
      const unsupportedProgress = scoreDraft(testCase, draft(reply));
      expect(
        unsupportedProgress.find((check) => check.name === "does not invent a production progress update")
          ?.ok,
      ).toBe(false);
    }
  });

  it("distinguishes an intended re-sync from an unsupported claim that it already happened", () => {
    const distribution = draftCases.cases.find((candidate) => candidate.id === "distribution-unavailable")!;
    const completed = scoreDraft(
      distribution,
      draft("I have gone ahead and triggered a re-sync with our distribution team."),
    );
    const planned = scoreDraft(
      distribution,
      draft("I will ask our distribution team to re-sync the listing."),
    );
    expect(
      completed.find((check) => check.name === "does not claim a re-sync was already performed")?.ok,
    ).toBe(false);
    expect(planned.find((check) => check.name === "does not claim a re-sync was already performed")?.ok).toBe(
      true,
    );
  });

  // Both came from the first live run, where they caused false misses.
  it("reads past a greeting on the same line as the first sentence", () => {
    expect(openingOf("Dear Kavita, I completely understand your eagerness.")).toBe(
      "I completely understand your eagerness.",
    );
    expect(openingOf("Hi Meera,\n\nThank you for writing.")).toBe("Thank you for writing.");
  });

  it("accepts timelines written in words", () => {
    const general = draftCases.cases.find((candidate) => candidate.id === "general-description")!;
    const words = scoreDraft(
      general,
      draft(
        "Hi Meera,\n\nThank you. Yes, via your dashboard; changes show within three to five business days.",
      ),
    );
    expect(words.every((check) => check.ok)).toBe(true);
  });

  it("re-scores a saved report without model calls, keeping its replies and prompt version", () => {
    const general = draftCases.cases.find((candidate) => candidate.id === "general-description")!;
    const reply =
      "Dear Meera, thank you. Yes, use your dashboard; it shows within three to five business days.";
    const saved: DraftReport = {
      casesVersion: "old",
      promptVersion: "draft-old",
      today: draftCases.today,
      results: [
        {
          id: general.id,
          guidance: general.guidance,
          reply,
          error: null,
          checks: [{ name: "stale", ok: false }],
          factWarnings: [],
          kbSectionsUsed: ["kb.guidance.general_inquiry"],
          escalation: null,
          missingInformation: [],
          internalChecklist: [],
          model: "m",
        },
      ],
      summary: {
        cases: 1,
        answered: 1,
        checksPassed: 0,
        checksTotal: 1,
        casesPassed: 0,
        withFactWarnings: 0,
      },
    };
    const rescored = rescoreDraftReport(saved, draftCases);
    expect(rescored.promptVersion).toBe("draft-old");
    expect(rescored.casesVersion).toBe(draftCases.version);
    expect(rescored.results[0]!.reply).toBe(reply);
    expect(rescored.summary).toMatchObject({ casesPassed: 1 });
  });
});

describe("runners on the mock provider", () => {
  const env = loadEnv({ NODE_ENV: "test", AI_PRIMARY_PROVIDER: "mock" });
  const writer = {
    tokensUsedSince: async () => 0,
    appendUsageEvent: async () => {},
  } as unknown as SystemWriter;
  const router = createAiFromEnv(env, writer, captureLogger().logger, { mockResponders: MOCK_RESPONDERS });

  it("runs every triage case through the production classifier", async () => {
    const report = await runTriageEval({
      classify: createTriageClassifier({ router, timeoutMs: 5_000 }),
      golden,
      books,
    });
    expect(report.results).toHaveLength(golden.cases.length);
    expect(report.summary).toMatchObject({
      answered: golden.cases.length,
      schemaFailures: 0,
      unavailable: 0,
    });
    // Policy floors apply in the eval exactly as in production.
    expect(report.results.find((result) => result.id === "isbn-mismatch-sample")?.actual?.policyFloor).toBe(
      "isbn_error_floor",
    );
  });

  it("records schema failures without stopping, and rethrows real bugs", async () => {
    const failing: Classify = async () => {
      throw new AiRouteError("invalid_output", false);
    };
    const report = await runTriageEval({ classify: failing, golden, books, only: ["general-bio"] });
    expect(report.summary).toMatchObject({ cases: 1, schemaFailures: 1 });

    const broken: Classify = async () => {
      throw new TypeError("bug");
    };
    await expect(runTriageEval({ classify: broken, golden, books, only: ["general-bio"] })).rejects.toThrow(
      "bug",
    );
  });

  it("drafts every sample query through the production draft service", async () => {
    const at = new Date("2026-10-20T06:30:00Z");
    const drafts = createDraftService({ router, clock: () => at, audit: async () => {}, timeoutMs: 5_000 });
    const report = await runDraftEval({ drafts, cases: draftCases, authors, books });
    expect(report.summary).toMatchObject({ cases: 8, answered: 8 });
    for (const result of report.results) {
      expect(result.reply).toMatch(/^Hi \w+,/); // greeting with the first name (draft guards)
      expect(result.kbSectionsUsed.length).toBeGreaterThan(0);
    }
  });
});
