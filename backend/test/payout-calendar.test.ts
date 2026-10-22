// Payout calendar rules (.back/TEST_PLAN.md U-01..U-04; AI_SPEC section 8).
import {
  addDays,
  businessDate,
  isBelowPayoutThreshold,
  latestPassedPayout,
  payoutCalendar,
  payoutDueBy,
  paymentPossiblyOverdue,
  quarterOf,
} from "@bookleaf/shared";
import { describe, expect, it } from "vitest";

describe("businessDate", () => {
  it("uses Asia/Kolkata (UTC+5:30), so a late-UTC evening is already tomorrow", () => {
    expect(businessDate(new Date("2026-10-17T10:00:00Z"))).toBe("2026-10-17");
    expect(businessDate(new Date("2026-10-17T19:00:00Z"))).toBe("2026-10-18");
  });
});

describe("quarters", () => {
  it("finds the calendar quarter, its last day and label", () => {
    expect(quarterOf("2026-10-16")).toEqual({
      year: 2026,
      quarter: 4,
      start: "2026-10-01",
      end: "2026-12-31",
      label: "October–December 2026",
    });
    expect(quarterOf("2028-02-29").end).toBe("2028-03-31");
  });

  it("U-02 adds 45 calendar days to each quarter end", () => {
    expect(payoutDueBy(quarterOf("2026-02-01"))).toBe("2026-05-15"); // Mar 31
    expect(payoutDueBy(quarterOf("2026-05-01"))).toBe("2026-08-14"); // Jun 30
    expect(payoutDueBy(quarterOf("2026-08-01"))).toBe("2026-11-14"); // Sep 30
    expect(payoutDueBy(quarterOf("2026-11-01"))).toBe("2027-02-14"); // Dec 31
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap day
  });
});

describe("payoutCalendar", () => {
  it("U-01 on 2026-10-16: Jul–Sep 2026 closed, due 14 Nov; current quarter due 14 Feb 2027", () => {
    const calendar = payoutCalendar("2026-10-16");
    expect(calendar.lastClosedQuarter.label).toBe("July–September 2026");
    expect(calendar.lastClosedQuarterDueBy).toBe("2026-11-14");
    expect(calendar.nextQuarterEnd).toBe("2026-12-31");
    expect(calendar.nextQuarterDueBy).toBe("2027-02-14");
    expect(calendar.nextPayoutDueBy).toBe("2026-11-14");
  });

  it("moves the next payout to the current quarter once the last deadline has passed", () => {
    expect(payoutCalendar("2026-11-14").nextPayoutDueBy).toBe("2026-11-14"); // deadline day itself
    expect(payoutCalendar("2026-12-01").nextPayoutDueBy).toBe("2027-02-14");
  });

  it("handles the year boundary", () => {
    const calendar = payoutCalendar("2027-01-10");
    expect(calendar.lastClosedQuarter.label).toBe("October–December 2026");
    expect(calendar.lastClosedQuarterDueBy).toBe("2027-02-14");
  });
});

describe("threshold and overdue heuristics", () => {
  it("U-03 rolls over pending royalties strictly between 0 and 1,000", () => {
    expect([0, 850, 999.99, 1000, 1001].map(isBelowPayoutThreshold)).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
  });

  it("finds the latest payout deadline that has already passed", () => {
    expect(latestPassedPayout("2026-10-16")).toMatchObject({
      dueBy: "2026-08-14",
      quarter: { end: "2026-06-30" },
    });
  });

  it.each([
    ["2026-11-13", "April–June 2026", "2026-08-14"],
    ["2026-11-14", "April–June 2026", "2026-08-14"],
    ["2026-11-15", "July–September 2026", "2026-11-14"],
    ["2027-02-14", "July–September 2026", "2026-11-14"],
    ["2027-02-15", "October–December 2026", "2027-02-14"],
  ])("keeps the deadline day inclusive on %s", (today, label, dueBy) => {
    expect(latestPassedPayout(today)).toMatchObject({ quarter: { label }, dueBy });
  });

  it("does not mark a newly payable quarter overdue until the day after its deadline", () => {
    const book = {
      royaltyPending: 2000,
      lastRoyaltyPayoutDate: null,
      publicationDate: "2026-07-10",
    };
    expect(paymentPossiblyOverdue(book, "2026-11-14")).toBe(false);
    expect(paymentPossiblyOverdue(book, "2026-11-15")).toBe(true);
  });

  it("U-04 flags dataset books as the AI spec expects on 2026-10-16", () => {
    const today = "2026-10-16";
    // BK001: ₹3,570 pending, last paid 2025-10-15 -> possibly overdue
    expect(
      paymentPossiblyOverdue(
        { royaltyPending: 3570, lastRoyaltyPayoutDate: "2025-10-15", publicationDate: "2023-06-20" },
        today,
      ),
    ).toBe(true);
    // BK016: ₹850 is below the threshold -> not overdue (rolls over)
    expect(
      paymentPossiblyOverdue(
        { royaltyPending: 850, lastRoyaltyPayoutDate: null, publicationDate: "2024-11-05" },
        today,
      ),
    ).toBe(false);
    // BK002: fully paid
    expect(
      paymentPossiblyOverdue(
        { royaltyPending: 0, lastRoyaltyPayoutDate: "2025-12-01", publicationDate: "2024-01-10" },
        today,
      ),
    ).toBe(false);
    // BK005: never paid, published 2024 -> possibly overdue
    expect(
      paymentPossiblyOverdue(
        { royaltyPending: 2546, lastRoyaltyPayoutDate: null, publicationDate: "2024-07-05" },
        today,
      ),
    ).toBe(true);
  });

  it("is not overdue when the book was published or paid after the covered quarter", () => {
    const today = "2026-10-16"; // covered quarter ends 2026-06-30
    expect(
      paymentPossiblyOverdue(
        { royaltyPending: 2000, lastRoyaltyPayoutDate: null, publicationDate: "2026-07-10" },
        today,
      ),
    ).toBe(false);
    expect(
      paymentPossiblyOverdue(
        { royaltyPending: 1500, lastRoyaltyPayoutDate: "2026-08-01", publicationDate: "2024-01-01" },
        today,
      ),
    ).toBe(false);
    expect(
      paymentPossiblyOverdue(
        { royaltyPending: 1500, lastRoyaltyPayoutDate: null, publicationDate: null },
        today,
      ),
    ).toBe(false);
  });
});
