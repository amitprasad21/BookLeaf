// Reply editor helpers (admin/FLOWS.md F-M3, F-M4; AI-5).
import type { AdminTicketDetailDto, AiDraftDto, ThreadMessageDto } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import { escalationText, sectionsText, shouldDraftOnOpen } from "./reply-draft";

const message = (senderRole: ThreadMessageDto["senderRole"]): ThreadMessageDto => ({
  id: senderRole,
  senderRole,
  senderName: senderRole,
  body: "…",
  createdAt: "2026-10-19T10:00:00Z",
});

const ticket = (status: AdminTicketDetailDto["status"], messages: ThreadMessageDto[] = []) =>
  ({ status, messages }) as unknown as AdminTicketDetailDto;

const draft = (overrides: Partial<AiDraftDto> = {}) =>
  ({
    kbSectionsUsed: ["kb.company", "kb.royalty", "kb.guidance.royalty_payments"],
    needsEscalation: true,
    escalationTeam: "finance",
    ...overrides,
  }) as AiDraftDto;

describe("shouldDraftOnOpen", () => {
  it("drafts when it's the team's turn", () => {
    expect(shouldDraftOnOpen(ticket("open"))).toBe(true);
    expect(shouldDraftOnOpen(ticket("in_progress", [message("admin"), message("author")]))).toBe(true);
  });

  it("waits to be asked after the team replied, or on a finished ticket", () => {
    expect(shouldDraftOnOpen(ticket("in_progress", [message("admin")]))).toBe(false);
    expect(shouldDraftOnOpen(ticket("resolved"))).toBe(false);
    expect(shouldDraftOnOpen(ticket("closed"))).toBe(false);
  });
});

describe("draft details", () => {
  it("names the knowledge base sections used", () => {
    expect(sectionsText(draft())).toBe(
      "Company overview, Royalty policy, Response guidance: Royalty & Payments",
    );
    expect(sectionsText(draft({ kbSectionsUsed: ["kb.unknown"] }))).toBe("kb.unknown");
  });

  it("suggests an escalation only when the draft needs one", () => {
    expect(escalationText(draft())).toBe("Suggested escalation: finance team");
    expect(escalationText(draft({ needsEscalation: false }))).toBeNull();
    expect(escalationText(draft({ escalationTeam: "none" }))).toBeNull();
  });
});
