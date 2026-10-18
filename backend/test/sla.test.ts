// First-response targets and SLA states (.back/TICKET_LIFECYCLE.md section 3, A-08).
import {
  FIRST_RESPONSE_TARGET_HOURS,
  firstResponseDueAt,
  isUnresolved,
  overdueCreatedBefore,
  slaState,
  type SlaInput,
} from "@bookleaf/shared";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-10-18T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);

const ticket = (overrides: Partial<SlaInput> = {}): SlaInput => ({
  status: "open",
  priority: "critical",
  createdAt: ago(1 * HOUR),
  firstResponseAt: null,
  ...overrides,
});

describe("first-response targets", () => {
  it("are 4 / 24 / 48 / 72 hours, with untriaged treated as High", () => {
    expect(FIRST_RESPONSE_TARGET_HOURS).toEqual({
      critical: 4,
      high: 24,
      untriaged: 24,
      medium: 48,
      low: 72,
    });
    expect(firstResponseDueAt(NOW, null)).toEqual(new Date(NOW.getTime() + 24 * HOUR));
    expect(firstResponseDueAt(NOW, "low")).toEqual(new Date(NOW.getTime() + 72 * HOUR));
  });
});

describe("slaState without a first response", () => {
  it("is on_track until the last 25% of the target, then due_soon, then breached", () => {
    // Critical: 4 h target, due soon in the last hour.
    expect(slaState(ticket({ createdAt: ago(3 * HOUR) }), NOW)).toBe("on_track");
    expect(slaState(ticket({ createdAt: ago(3 * HOUR + 1) }), NOW)).toBe("due_soon");
    expect(slaState(ticket({ createdAt: ago(4 * HOUR) }), NOW)).toBe("due_soon"); // due right now
    expect(slaState(ticket({ createdAt: ago(4 * HOUR + 1) }), NOW)).toBe("breached");
  });

  it("uses each priority's own target", () => {
    expect(slaState(ticket({ priority: "high", createdAt: ago(20 * HOUR) }), NOW)).toBe("due_soon");
    expect(slaState(ticket({ priority: null, createdAt: ago(25 * HOUR) }), NOW)).toBe("breached");
    expect(slaState(ticket({ priority: "medium", createdAt: ago(25 * HOUR) }), NOW)).toBe("on_track");
    expect(slaState(ticket({ priority: "low", createdAt: ago(60 * HOUR) }), NOW)).toBe("due_soon");
  });

  it("applies to in_progress tickets too", () => {
    expect(slaState(ticket({ status: "in_progress", createdAt: ago(5 * HOUR) }), NOW)).toBe("breached");
  });

  it("is not_applicable once resolved or closed (the clock stops when work ends)", () => {
    for (const status of ["resolved", "closed"] as const) {
      expect(slaState(ticket({ status, createdAt: ago(100 * HOUR) }), NOW)).toBe("not_applicable");
    }
  });
});

describe("slaState with a first response", () => {
  it("is met on or before the target and breached after it, whatever the status", () => {
    const createdAt = ago(10 * HOUR);
    const due = firstResponseDueAt(createdAt, "critical");
    expect(slaState(ticket({ createdAt, firstResponseAt: due }), NOW)).toBe("met");
    expect(slaState(ticket({ createdAt, firstResponseAt: new Date(due.getTime() + 1) }), NOW)).toBe(
      "breached",
    );
    expect(slaState(ticket({ status: "closed", createdAt, firstResponseAt: due }), NOW)).toBe("met");
  });
});

describe("overdueCreatedBefore", () => {
  it("gives, per priority, the creation instant before which a waiting ticket is overdue", () => {
    expect(overdueCreatedBefore(NOW)).toEqual({
      critical: ago(4 * HOUR),
      high: ago(24 * HOUR),
      untriaged: ago(24 * HOUR),
      medium: ago(48 * HOUR),
      low: ago(72 * HOUR),
    });
  });

  it("agrees with slaState at the cut-off", () => {
    const cutOff = overdueCreatedBefore(NOW).medium;
    expect(slaState(ticket({ priority: "medium", createdAt: cutOff }), NOW)).toBe("due_soon");
    expect(slaState(ticket({ priority: "medium", createdAt: new Date(cutOff.getTime() - 1) }), NOW)).toBe(
      "breached",
    );
  });
});

describe("isUnresolved", () => {
  it("is true for open and in_progress only", () => {
    expect(["open", "in_progress", "resolved", "closed"].map((s) => isUnresolved(s as never))).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });
});
