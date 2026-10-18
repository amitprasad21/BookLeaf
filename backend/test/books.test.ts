import { readFileSync } from "node:fs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { SeedDataSchema, toBookRows } from "../scripts/seed-data.js";
import { TEST_TOKENS, bearer, buildTestApp, fakeDb, fakeVerifier, fixedClock } from "./helpers.js";

const dataset = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
// All 18 books: the fake db has no RLS, so only the backend's own author filter can narrow them.
const allBooks = toBookRows(dataset);

const spec = parse(readFileSync(new URL("../../openapi.yaml", import.meta.url), "utf8")) as {
  components: { schemas: Record<string, { properties: Record<string, unknown> }> };
};

function app(today = "2026-10-16", db = fakeDb({ books: allBooks })) {
  return buildTestApp({}, undefined, fakeVerifier(db), fixedClock(today));
}

const getBooks = (application = app()) =>
  request(application).get("/api/v1/author/books").set("Authorization", bearer(TEST_TOKENS.author));

describe("GET /api/v1/author/books", () => {
  it("returns only the caller's books, even when the database would return more", async () => {
    const res = await getBooks();
    expect(res.status).toBe(200);
    expect(res.body.data.books.map((book: { bookId: string }) => book.bookId)).toEqual(["BK001", "BK002"]);
  });

  it("maps every field exactly, in camelCase", async () => {
    const res = await getBooks();
    expect(res.body.data.books[0]).toEqual({
      bookId: "BK001",
      title: "Whispers of the Ganges",
      isbn: "978-93-5XXXX-01-1",
      genre: "Literary Fiction",
      publicationDate: "2023-06-20",
      status: "Published & Live",
      isPublished: true,
      mrp: 399,
      authorRoyaltyPerCopy: 35,
      totalCopiesSold: 342,
      totalRoyaltyEarned: 11970,
      royaltyPaid: 8400,
      royaltyPending: 3570,
      lastRoyaltyPayoutDate: "2025-10-15",
      printPartner: "In-House",
      availableOn: ["Amazon India", "Flipkart", "BookLeaf Store"],
    });
  });

  it("summarises royalties with the next payout deadline", async () => {
    const res = await getBooks();
    expect(res.body.data.summary).toEqual({
      totalEarned: 19908, // 11,970 + 7,938
      totalPaid: 16338, // 8,400 + 7,938
      totalPending: 3570,
      payoutThreshold: 1000,
      pendingBelowThreshold: false,
      nextPayoutDueBy: "2026-11-14",
    });
  });

  it("moves the next payout deadline with the clock", async () => {
    const res = await getBooks(app("2026-12-01"));
    expect(res.body.data.summary.nextPayoutDueBy).toBe("2027-02-14");
  });

  it("keeps nulls for a book in production and flags pending below the ₹1,000 threshold", async () => {
    // AUTH009 shape: BK015 in production, BK016 with ₹850 pending.
    const kavitaBooks = allBooks
      .filter((book) => book.author_id === "AUTH009")
      .map((book) => ({ ...book, author_id: "AUTH001" }));
    const res = await getBooks(app("2026-10-16", fakeDb({ books: kavitaBooks })));

    const bk015 = res.body.data.books.find((book: { bookId: string }) => book.bookId === "BK015");
    expect(bk015).toMatchObject({
      isPublished: false,
      publicationDate: null,
      mrp: null,
      authorRoyaltyPerCopy: null,
      printPartner: null,
      totalCopiesSold: 0,
      availableOn: [],
    });
    expect(res.body.data.summary).toMatchObject({ totalPending: 850, pendingBelowThreshold: true });
  });

  it("returns an empty list and zero totals for an author with no books", async () => {
    const res = await getBooks(app("2026-10-16", fakeDb({ books: [] })));
    expect(res.body.data.books).toEqual([]);
    expect(res.body.data.summary).toMatchObject({
      totalEarned: 0,
      totalPending: 0,
      pendingBelowThreshold: false,
    });
  });

  it("hides database errors behind a generic 500", async () => {
    const res = await getBooks(app("2026-10-16", fakeDb({}, { code: "XX000", message: "internal detail" })));
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("internal detail");
  });

  it("is author-only (admins get 403)", async () => {
    const res = await request(app())
      .get("/api/v1/author/books")
      .set("Authorization", bearer(TEST_TOKENS.admin));
    expect(res.status).toBe(403);
  });
});

describe("books contract: response keys match openapi.yaml", () => {
  it("Book and RoyaltySummary DTO keys equal the schema properties", async () => {
    const res = await getBooks();
    expect(Object.keys(res.body.data.books[0]).sort()).toEqual(
      Object.keys(spec.components.schemas.Book!.properties).sort(),
    );
    expect(Object.keys(res.body.data.summary).sort()).toEqual(
      Object.keys(spec.components.schemas.RoyaltySummary!.properties).sort(),
    );
  });
});
