import { describe, expect, it } from "vitest";
import { shortDuration, slaLabel } from "./sla-label";

const now = new Date("2026-10-19T12:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();

describe("slaLabel", () => {
  it("says how long a ticket is overdue (Critical: 4 h target)", () => {
    expect(slaLabel({ slaState: "breached", priority: "critical", createdAt: hoursAgo(10) }, now)).toBe(
      "Overdue · 6 h",
    );
  });

  it("says when a ticket is due (untriaged counts as High: 24 h)", () => {
    expect(slaLabel({ slaState: "due_soon", priority: null, createdAt: hoursAgo(23) }, now)).toBe(
      "Due in 1 h",
    );
  });

  it("flags a late first reply, and nothing when on track or met", () => {
    expect(slaLabel({ slaState: "breached", priority: "low", createdAt: hoursAgo(1) }, now)).toBe(
      "First reply was late",
    );
    expect(slaLabel({ slaState: "on_track", priority: "low", createdAt: hoursAgo(1) }, now)).toBeNull();
    expect(slaLabel({ slaState: "met", priority: "low", createdAt: hoursAgo(1) }, now)).toBeNull();
  });
});

describe("shortDuration", () => {
  it("uses minutes, hours, then days", () => {
    expect(shortDuration(30_000)).toBe("1 min");
    expect(shortDuration(45 * 60_000)).toBe("45 min");
    expect(shortDuration(47 * 3_600_000)).toBe("47 h");
    expect(shortDuration(72 * 3_600_000)).toBe("3 d");
  });
});
