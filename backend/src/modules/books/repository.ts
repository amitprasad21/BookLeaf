import type { SupabaseClient } from "@supabase/supabase-js";

export interface BookRow {
  book_id: string;
  author_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

const BOOK_COLUMNS =
  "book_id, author_id, title, isbn, genre, publication_date, status, mrp, author_royalty_per_copy, " +
  "total_copies_sold, total_royalty_earned, royalty_paid, royalty_pending, last_royalty_payout_date, " +
  "print_partner, available_on";

/**
 * The author's own books. `db` is the caller's RLS-scoped client, and the
 * explicit author filter repeats the ownership rule in code (defense in depth).
 */
export async function listBooksForAuthor(db: SupabaseClient, authorId: string): Promise<BookRow[]> {
  const { data, error } = await db
    .from("books")
    .select(BOOK_COLUMNS)
    .eq("author_id", authorId)
    .order("book_id", { ascending: true });
  if (error) throw new Error(`books query failed (${error.code})`);
  return (data ?? []) as unknown as BookRow[];
}
