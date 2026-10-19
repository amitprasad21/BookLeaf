// Display formatting and production stages shared by both portals
// (.front/DESIGN_SYSTEM.md section 7, author TEST_PLAN AT-10).
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatInr,
  formatRelative,
  NULL_WORDING,
  PRODUCTION_STAGES,
  productionStage,
} from "@bookleaf/shared";
import { describe, expect, it } from "vitest";

describe("money and counts", () => {
  it("formats whole rupees with Indian grouping", () => {
    expect(formatInr(11970)).toBe("₹11,970");
    expect(formatInr(0)).toBe("₹0");
    expect(formatInr(1234567)).toBe("₹12,34,567");
  });

  it("rounds paise away", () => {
    expect(formatInr(849.6)).toBe("₹850");
  });

  it("groups counts the Indian way", () => {
    expect(formatCount(1567)).toBe("1,567");
    expect(formatCount(150000)).toBe("1,50,000");
  });
});

describe("dates", () => {
  it("formats calendar dates as written, in any time zone", () => {
    expect(formatDate("2023-06-20")).toBe("20 Jun 2023");
    expect(formatDate("2023-06-20", "long")).toBe("20 June 2023");
    expect(formatDate("2023-06-20", "short", "America/Los_Angeles")).toBe("20 Jun 2023");
  });

  it("formats timestamps in the given time zone", () => {
    expect(formatDate("2026-10-18T20:00:00Z", "short", "Asia/Kolkata")).toBe("19 Oct 2026");
    expect(formatDateTime("2026-10-19T10:55:00Z", "Asia/Kolkata")).toBe("19 Oct 2026, 4:25 pm");
  });
});

describe("relative times", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("says just now, minutes, hours and days", () => {
    expect(formatRelative(ago(20_000), now)).toBe("just now");
    expect(formatRelative(ago(5 * 60_000), now)).toBe("5 min ago");
    expect(formatRelative(ago(2 * 3_600_000 + 59 * 60_000), now)).toBe("2 h ago");
    expect(formatRelative(ago(3 * 86_400_000), now)).toBe("3 d ago");
  });

  it("falls back to a date after a week, and treats small future skew as now", () => {
    expect(formatRelative("2026-10-01T06:30:00Z", now, "Asia/Kolkata")).toBe("1 Oct 2026");
    expect(formatRelative(new Date(now.getTime() + 5_000).toISOString(), now)).toBe("just now");
  });
});

describe("null wording", () => {
  it("matches DESIGN_SYSTEM.md section 7", () => {
    expect(NULL_WORDING).toEqual({
      money: "Not yet set",
      publicationDate: "Not yet published",
      lastPayout: "No payout yet",
      printPartner: "Not assigned yet",
      platforms: "Not listed yet",
      notOnSale: "Not yet on sale",
    });
  });
});

describe("production stages", () => {
  it("lists the nine KB stages in order", () => {
    expect(PRODUCTION_STAGES).toHaveLength(9);
    expect(PRODUCTION_STAGES[2]).toBe("Cover Design");
  });

  it("reads 'In Production - <stage>' statuses", () => {
    expect(productionStage("In Production - Cover Design")).toEqual({
      stage: "Cover Design",
      number: 3,
      of: 9,
    });
    expect(productionStage("In Production - Typesetting")).toEqual({
      stage: "Typesetting",
      number: 4,
      of: 9,
    });
  });

  it("keeps an unknown stage with number 0, and ignores other statuses", () => {
    expect(productionStage("In Production - Illustration")).toEqual({
      stage: "Illustration",
      number: 0,
      of: 9,
    });
    expect(productionStage("Published & Live")).toBeNull();
  });
});
