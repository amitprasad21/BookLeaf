// Live GET /api/v1/author/books (npm run test:live): real verifier, real RLS,
// real seeded data. Every value is checked against the dataset file. Reads only.
import { readFileSync } from "node:fs";
import { businessDate, payoutCalendar } from "@bookleaf/shared";
import { createClient } from "@supabase/supabase-js";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { SeedDataSchema, toBookRows, type BookRow } from "../scripts/seed-data.js";
import { createApp } from "../src/app.js";
import { createSupabaseVerifier } from "../src/auth/supabase-verifier.js";
import { loadEnv } from "../src/config/env.js";
import { createLogger } from "../src/lib/logger.js";
import { recordingSystemWriter } from "../test/fakes.js";

const env = {
  url: process.env.SUPABASE_URL ?? "",
  publishable: process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
  authorPassword: process.env.SEED_AUTHOR_PASSWORD ?? "",
};
const configured = Object.values(env).every((value) => value !== "" && !value.startsWith("replace-with"));

const data = SeedDataSchema.parse(
  JSON.parse(readFileSync(new URL("../../supabase/seed/bookleaf_sample_data.json", import.meta.url), "utf8")),
);
const authorEmail = (id: string) => data.authors.find((author) => author.author_id === id)!.email;
const booksOf = (id: string) => toBookRows(data).filter((book) => book.author_id === id);

/** The DTO the API must return for a dataset book. */
const expectedDto = (book: BookRow) => ({
  bookId: book.book_id,
  title: book.title,
  isbn: book.isbn,
  genre: book.genre,
  publicationDate: book.publication_date,
  status: book.status,
  isPublished: book.status === "Published & Live",
  mrp: book.mrp,
  authorRoyaltyPerCopy: book.author_royalty_per_copy,
  totalCopiesSold: book.total_copies_sold,
  totalRoyaltyEarned: book.total_royalty_earned,
  royaltyPaid: book.royalty_paid,
  royaltyPending: book.royalty_pending,
  lastRoyaltyPayoutDate: book.last_royalty_payout_date,
  printPartner: book.print_partner,
  availableOn: book.available_on,
});

async function accessToken(email: string): Promise<string> {
  const client = createClient(env.url, env.publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error } = await client.auth.signInWithPassword({
    email,
    password: env.authorPassword,
  });
  if (error || !session.session) throw new Error(`Sign-in failed for a seeded author (${error?.code}).`);
  return session.session.access_token;
}

describe.runIf(configured)("GET /author/books against live Supabase", () => {
  const app = createApp({
    env: loadEnv({ NODE_ENV: "test", SUPABASE_URL: env.url, SUPABASE_PUBLISHABLE_KEY: env.publishable }),
    logger: createLogger({ LOG_LEVEL: "silent" }),
    verifier: createSupabaseVerifier({ url: env.url, publishableKey: env.publishable }),
    systemWriter: recordingSystemWriter().writer, // read-only suite: nothing is audited
  });
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    for (const id of ["AUTH001", "AUTH007", "AUTH009"]) tokens[id] = await accessToken(authorEmail(id));
  });

  const getBooks = (id: string) =>
    request(app).get("/api/v1/author/books").set("Authorization", `Bearer ${tokens[id]}`);

  it.each(["AUTH001", "AUTH007", "AUTH009"])(
    "%s gets exactly their dataset books, field for field",
    async (id) => {
      const res = await getBooks(id);
      expect(res.status).toBe(200);
      expect(res.body.data.books).toEqual(booksOf(id).map(expectedDto));
    },
  );

  it("AUTH001 totals and the next payout deadline match the dataset and calendar", async () => {
    const res = await getBooks("AUTH001");
    expect(res.body.data.summary).toEqual({
      totalEarned: 19908,
      totalPaid: 16338,
      totalPending: 3570,
      payoutThreshold: 1000,
      pendingBelowThreshold: false,
      nextPayoutDueBy: payoutCalendar(businessDate(new Date())).nextPayoutDueBy,
    });
  });

  it("AUTH009 (book in production + ₹850 pending) keeps nulls and flags the rollover", async () => {
    const res = await getBooks("AUTH009");
    const bk015 = res.body.data.books.find((book: { bookId: string }) => book.bookId === "BK015");
    expect(bk015).toMatchObject({ isPublished: false, mrp: null, publicationDate: null, availableOn: [] });
    expect(res.body.data.summary).toMatchObject({ totalPending: 850, pendingBelowThreshold: true });
  });

  it("no author sees another author's books", async () => {
    const ids = new Set<string>();
    for (const id of ["AUTH001", "AUTH007", "AUTH009"]) {
      const res = await getBooks(id);
      for (const book of res.body.data.books) {
        expect(ids.has(book.bookId)).toBe(false);
        ids.add(book.bookId);
      }
    }
    expect([...ids].sort()).toEqual(["BK001", "BK002", "BK011", "BK012", "BK013", "BK015", "BK016"]);
  });
});

describe.skipIf(configured)("GET /author/books against live Supabase (skipped)", () => {
  it("needs SUPABASE_* and SEED_AUTHOR_PASSWORD in backend/.env", () => {
    expect(configured).toBe(false);
  });
});
