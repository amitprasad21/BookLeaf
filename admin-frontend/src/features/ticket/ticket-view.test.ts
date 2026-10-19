// Ticket page wording and rules (admin/SCREENS.md M3, STATES.md, FLOWS.md F-M2, F-M7).
import type { AdminTicketDetailDto, TimelineEventDto } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import {
  describeEvent,
  isLowConfidence,
  latestActor,
  needsConfirmation,
  policyFloorText,
  statusOptions,
  suggestionText,
} from "./ticket-view";

const ticket = (
  overrides: Partial<AdminTicketDetailDto> = {},
  ai: Partial<AdminTicketDetailDto["ai"]> = {},
) =>
  ({
    category: "isbn_metadata",
    categorySource: "ai",
    priority: "high",
    prioritySource: "ai",
    timeline: [],
    ...overrides,
    ai: {
      status: "completed",
      suggestedCategory: "isbn_metadata",
      suggestedPriority: "medium",
      confidence: 0.82,
      signals: ["isbn_error"],
      rationale: "Wrong ISBN printed on the back cover.",
      policyFloorApplied: "isbn_error_floor",
      processedAt: "2026-10-19T10:00:00Z",
      failureReason: null,
      ...ai,
    },
  }) as AdminTicketDetailDto;

const event = (action: string, metadata: Record<string, unknown> = {}): TimelineEventDto => ({
  id: action,
  action,
  actor: { userId: "u1", displayName: "Ops Admin" },
  metadata,
  createdAt: "2026-10-19T10:00:00Z",
});

describe("status options (F-M7)", () => {
  it("offers only the allowed transitions, named as actions", () => {
    expect(statusOptions("open").map((option) => option.label)).toEqual([
      "Open (current)",
      "Start (In progress)",
      "Resolve",
      "Close",
    ]);
    expect(statusOptions("closed")).toEqual([
      { value: "closed", label: "Closed (current)" },
      { value: "in_progress", label: "Reopen (In progress)" },
    ]);
  });

  it("asks before closing or reopening", () => {
    expect(needsConfirmation("open", "closed")).toBe(true);
    expect(needsConfirmation("resolved", "in_progress")).toBe(true);
    expect(needsConfirmation("open", "in_progress")).toBe(false);
    expect(needsConfirmation("in_progress", "resolved")).toBe(false);
  });
});

describe("triage wording", () => {
  it("shows the AI suggestion with its confidence", () => {
    expect(suggestionText("category", ticket())).toEqual({
      source: "ai",
      tag: "AI suggestion · 82% confident",
      note: null,
    });
  });

  it("shows an admin override with the AI's original pick", () => {
    expect(suggestionText("priority", ticket({ prioritySource: "admin", priority: "critical" }))).toEqual({
      source: "admin",
      tag: "Set by admin",
      note: "AI suggested Medium",
    });
  });

  it("explains a policy floor only while the AI value stands", () => {
    expect(policyFloorText(ticket())).toBe("Raised to High by policy: ISBN errors are at least High");
    expect(policyFloorText(ticket({ prioritySource: "admin" }))).toBeNull();
    expect(policyFloorText(ticket({}, { policyFloorApplied: null }))).toBeNull();
  });

  it("flags confidence below 0.5", () => {
    expect(isLowConfidence(ticket({}, { confidence: 0.42 }))).toBe(true);
    expect(isLowConfidence(ticket({}, { confidence: 0.5 }))).toBe(false);
    expect(isLowConfidence(ticket({}, { confidence: null }))).toBe(false);
  });
});

describe("timeline", () => {
  it("describes each audit event without message text", () => {
    expect(describeEvent(event("ticket.created"))).toBe("Ticket raised");
    expect(
      describeEvent(event("ticket.triaged", { category: "royalty_payments", priority: "critical" })),
    ).toBe("AI triaged: Royalty & Payments · Critical");
    expect(
      describeEvent(event("ticket.priority_overridden", { from: null, fromSource: null, to: "high" })),
    ).toBe("Priority changed from Needs triage to High");
    expect(
      describeEvent(event("ticket.category_overridden", { from: "general_inquiry", to: "isbn_metadata" })),
    ).toBe("Category changed from General Inquiry to ISBN & Metadata Issues");
    expect(
      describeEvent(event("ticket.status_changed", { from: "open", to: "in_progress", via: "reply" })),
    ).toBe("Status changed from Open to In progress with a reply");
    expect(describeEvent(event("ticket.reply_sent", { draftId: "d1" }))).toBe(
      "Reply sent (from an AI draft)",
    );
    expect(describeEvent(event("ticket.reply_sent", { draftId: null }))).toBe("Reply sent");
    expect(describeEvent(event("ai.draft_regenerated"))).toBe("AI draft regenerated");
    expect(describeEvent(event("something.new"))).toBe("something.new");
  });

  it("names who made the latest change, for the conflict notice", () => {
    const older = { ...event("ticket.assigned"), createdAt: "2026-10-19T09:00:00Z" };
    const newer = { ...event("ticket.status_changed"), actor: { userId: "u2", displayName: "Support Lead" } };
    expect(latestActor(ticket({ timeline: [newer, older] }))).toBe("Support Lead");
    expect(latestActor(ticket({ timeline: [] }))).toBe("another admin");
  });
});
