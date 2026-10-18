import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ACCOUNTS,
  SeedDataSchema,
  diffRows,
  seedAccounts,
  toAuthorRows,
  toBookRows,
} from "../scripts/seed-data.js";

const raw = JSON.parse(
  readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8"),
) as unknown;
const data = SeedDataSchema.parse(raw);

describe("seed dataset", () => {
  it("validates the provided file exactly: 10 authors, 18 books", () => {
    expect(toAuthorRows(data)).toHaveLength(10);
    expect(toBookRows(data)).toHaveLength(18);
  });

  it("maps authors without their nested books", () => {
    const priya = toAuthorRows(data).find((author) => author.author_id === "AUTH001");
    expect(priya).toEqual({
      author_id: "AUTH001",
      name: "Priya Sharma",
      email: "priya.sharma@email.com",
      phone: "+91-98765-43210",
      city: "Mumbai",
      joined_date: "2023-03-15",
    });
  });

  it("gives every book its author's id and preserves nulls for books in production", () => {
    const bk013 = toBookRows(data).find((book) => book.book_id === "BK013");
    expect(bk013).toMatchObject({
      author_id: "AUTH007",
      status: "In Production - Cover Design",
      publication_date: null,
      mrp: null,
      author_royalty_per_copy: null,
      print_partner: null,
      available_on: [],
      total_copies_sold: 0,
    });
  });

  it("preserves the Unicode title exactly", () => {
    expect(toBookRows(data).find((book) => book.book_id === "BK017")?.title).toBe("Durga’s Daughters");
  });

  it("creates one login per author plus the two admins", () => {
    const accounts = seedAccounts(data);
    expect(accounts).toHaveLength(12);
    expect(accounts.filter((account) => account.role === "author").map((a) => a.authorId)).toEqual(
      data.authors.map((author) => author.author_id),
    );
    expect(accounts.slice(-2)).toEqual([...ADMIN_ACCOUNTS]);
    expect(new Set(accounts.map((account) => account.email)).size).toBe(12);
  });

  it("rejects unknown fields and wrong types", () => {
    const tampered = structuredClone(raw) as { authors: Record<string, unknown>[] };
    tampered.authors[0]!.role = "admin";
    expect(SeedDataSchema.safeParse(tampered).success).toBe(false);

    const wrongType = structuredClone(raw) as { authors: { books: Record<string, unknown>[] }[] };
    wrongType.authors[0]!.books[0]!.mrp = "399";
    expect(SeedDataSchema.safeParse(wrongType).success).toBe(false);
  });
});

describe("diffRows", () => {
  const expected = toBookRows(data);

  it("reports nothing when the database matches", () => {
    expect(
      diffRows(
        expected,
        expected.map((book) => ({ ...book, created_at: "2026-10-17T00:00:00Z" })),
        "book_id",
      ),
    ).toEqual([]);
  });

  it("reports mismatched fields and missing rows by label, not value", () => {
    const actual = expected
      .filter((book) => book.book_id !== "BK002")
      .map((book) => (book.book_id === "BK001" ? { ...book, mrp: 400 } : book));
    expect(diffRows(expected, actual, "book_id")).toEqual(["BK001.mrp", "BK002 (missing)"]);
  });
});
