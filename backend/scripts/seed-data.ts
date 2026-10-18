// Pure seed logic for scripts/seed.ts: validates the assessment dataset exactly
// and maps it to table rows and login accounts. No I/O here, so it is unit-tested.
import { z } from "zod";

const BookSchema = z.strictObject({
  book_id: z.string().regex(/^BK\d{3,}$/),
  title: z.string().min(1),
  isbn: z.string().min(1), // placeholder format in the dataset: never checksum-validated
  genre: z.string().min(1),
  publication_date: z.iso.date().nullable(),
  status: z.string().min(1),
  mrp: z.number().nonnegative().nullable(),
  author_royalty_per_copy: z.number().nonnegative().nullable(),
  total_copies_sold: z.number().int().nonnegative(),
  total_royalty_earned: z.number().nonnegative(),
  royalty_paid: z.number().nonnegative(),
  royalty_pending: z.number().nonnegative(),
  last_royalty_payout_date: z.iso.date().nullable(),
  print_partner: z.string().nullable(),
  available_on: z.array(z.string()),
});

const AuthorSchema = z.strictObject({
  author_id: z.string().regex(/^AUTH\d{3,}$/),
  name: z.string().min(1),
  email: z.email(),
  phone: z.string(),
  city: z.string(),
  joined_date: z.iso.date(),
  books: z.array(BookSchema),
});

export const SeedDataSchema = z.strictObject({ authors: z.array(AuthorSchema).min(1) });

export type SeedData = z.infer<typeof SeedDataSchema>;
export type AuthorRow = Omit<SeedData["authors"][number], "books">;
export type BookRow = SeedData["authors"][number]["books"][number] & { author_id: string };

export interface SeedAccount {
  email: string;
  role: "author" | "admin";
  authorId: string | null;
  displayName: string;
}

/** Ops accounts created alongside the dataset (`.test` is a reserved TLD; assumption A-06). */
export const ADMIN_ACCOUNTS: readonly SeedAccount[] = [
  { email: "admin@bookleaf.test", role: "admin", authorId: null, displayName: "Ops Admin" },
  { email: "support.lead@bookleaf.test", role: "admin", authorId: null, displayName: "Support Lead" },
];

export function toAuthorRows(data: SeedData): AuthorRow[] {
  return data.authors.map((author) => ({
    author_id: author.author_id,
    name: author.name,
    email: author.email,
    phone: author.phone,
    city: author.city,
    joined_date: author.joined_date,
  }));
}

export function toBookRows(data: SeedData): BookRow[] {
  return data.authors.flatMap((author) =>
    author.books.map((book) => ({ ...book, author_id: author.author_id })),
  );
}

export function seedAccounts(data: SeedData): SeedAccount[] {
  const authors = data.authors.map((author) => ({
    email: author.email.toLowerCase(),
    role: "author" as const,
    authorId: author.author_id,
    displayName: author.name,
  }));
  return [...authors, ...ADMIN_ACCOUNTS];
}

/**
 * Field-by-field comparison of expected rows against rows read back from the
 * database. Returns "<key>.<field>" labels for every mismatch or missing row,
 * never the values themselves.
 */
export function diffRows<T extends object>(
  expected: readonly T[],
  actual: readonly Record<string, unknown>[],
  key: keyof T & string,
): string[] {
  const byKey = new Map(actual.map((row) => [String(row[key]), row]));
  const mismatches: string[] = [];
  for (const row of expected) {
    const id = String((row as Record<string, unknown>)[key]);
    const found = byKey.get(id);
    if (!found) {
      mismatches.push(`${id} (missing)`);
      continue;
    }
    for (const [field, value] of Object.entries(row)) {
      if (JSON.stringify(found[field]) !== JSON.stringify(value)) mismatches.push(`${id}.${field}`);
    }
  }
  return mismatches;
}
