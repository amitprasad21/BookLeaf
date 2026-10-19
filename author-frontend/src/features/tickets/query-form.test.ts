// Raise a query: validation and server error mapping (author TEST_PLAN AT-04, AT-05).
import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_ERROR,
  GENERAL,
  attachmentProblem,
  retryAfterText,
  serverFieldErrors,
  validateQuery,
} from "./query-form";

const valid = {
  about: "BK001",
  subject: "Royalty for Q3 not received",
  description: "My Q3 royalty hasn't arrived and it's past the 45-day window.",
};

describe("validateQuery (AT-04)", () => {
  it("accepts a complete query and builds the API request", () => {
    expect(validateQuery(valid, null)).toEqual({
      ok: true,
      request: {
        bookId: "BK001",
        subject: valid.subject,
        description: valid.description,
        attachmentName: null,
      },
    });
  });

  it("sends General / Account Level as a null book", () => {
    const result = validateQuery({ ...valid, about: GENERAL }, "statement.pdf");
    expect(result.ok && result.request).toMatchObject({ bookId: null, attachmentName: "statement.pdf" });
  });

  it("blocks short subjects and descriptions with inline messages", () => {
    const result = validateQuery({ about: "", subject: "Help", description: "Too short." }, null);
    expect(result).toEqual({
      ok: false,
      errors: {
        about: "Choose a book or General / Account Level.",
        subject: "Add a subject of at least 5 characters.",
        description: "Please describe your query in at least 20 characters.",
      },
    });
  });

  it("counts trimmed text, as the API does", () => {
    const result = validateQuery({ ...valid, subject: "   Hi   " }, null);
    expect(result.ok).toBe(false);
  });
});

describe("serverFieldErrors (AT-05)", () => {
  it("maps VALIDATION_FAILED details onto fields", () => {
    expect(
      serverFieldErrors([
        { path: "subject", issue: "Too small: expected string to have >=5 characters" },
        { path: "bookId", issue: "must be one of your books, or null for General / Account Level" },
        { path: "unknown", issue: "ignored" },
      ]),
    ).toEqual({
      subject: "Add a subject of at least 5 characters.",
      about: "Choose one of your books or General / Account Level.",
    });
  });

  it("maps a too-long description", () => {
    expect(
      serverFieldErrors([
        { path: "description", issue: "Too big: expected string to have <=5000 characters" },
      ]),
    ).toEqual({ description: "Keep the description to 5,000 characters or fewer." });
  });
});

describe("attachments", () => {
  it("accepts JPG, PNG and PDF up to 5 MB", () => {
    expect(attachmentProblem({ name: "Statement.PDF", size: 5 * 1024 * 1024 })).toBeNull();
    expect(attachmentProblem({ name: "cover.jpeg", size: 1000 })).toBeNull();
  });

  it("rejects other types and larger files", () => {
    expect(attachmentProblem({ name: "notes.docx", size: 1000 })).toBe(ATTACHMENT_ERROR);
    expect(attachmentProblem({ name: "scan.png", size: 5 * 1024 * 1024 + 1 })).toBe(ATTACHMENT_ERROR);
  });
});

describe("retryAfterText", () => {
  it("rounds up to whole minutes", () => {
    expect(retryAfterText(61)).toBe("Please try again in 2 minutes.");
    expect(retryAfterText(30)).toBe("Please try again in 1 minute.");
    expect(retryAfterText(null)).toBe("Please try again in a few minutes.");
  });
});
