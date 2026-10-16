# Seed Data

**Owns:** how the assessment dataset is loaded, the accounts created alongside it, and the edge cases it contains. Source: [supabase/seed/bookleaf_sample_data.json](../supabase/seed/bookleaf_sample_data.json) (byte-identical to the provided file; constraint C-02).

## 1. Dataset summary (verified 2026-10-16)

| Author | Name | City | Books | Notes |
|---|---|---|---|---|
| AUTH001 | Priya Sharma | Mumbai | BK001, BK002 | BK002 fully paid |
| AUTH002 | Rohit Kapoor | Delhi | BK003, BK004 | Largest pending (BK004 ₹7,744) |
| AUTH003 | Ananya Reddy | Hyderabad | BK005 | Never paid (₹2,546 pending) |
| AUTH004 | Vikram Joshi | Pune | BK006, BK007 | BK007 fully paid |
| AUTH005 | Meera Nair | Kochi | BK008, BK009 | BK008 fully paid |
| AUTH006 | Arjun Malhotra | Chandigarh | BK010 | Never paid (₹2,464 pending) |
| AUTH007 | Sneha Kulkarni | Bangalore | BK011, BK012, BK013 | BK013 in production (Cover Design) |
| AUTH008 | Farhan Sheikh | Lucknow | BK014 | Fully paid |
| AUTH009 | Kavita Deshmukh | Nagpur | BK015, BK016 | BK015 in production (Typesetting); BK016 never paid, ₹850 < threshold |
| AUTH010 | Diya Chatterjee | Kolkata | BK017, BK018 | BK017 title has a curly apostrophe; BK018 never paid |

Totals: 10 authors, 18 books (16 "Published & Live", 2 in production); total pending ₹40,839. For every book, `author_royalty_per_copy × total_copies_sold = total_royalty_earned` and `royalty_paid + royalty_pending = total_royalty_earned`.

## 2. Mapping

JSON keys map 1:1 to columns of the same name in `authors` and `books` ([DATA_MODEL.md](DATA_MODEL.md)); `books.author_id` comes from the parent author. Rules:

- Preserve `null` exactly (`publication_date`, `mrp`, `author_royalty_per_copy`, `last_royalty_payout_date`, `print_partner`).
- Preserve `available_on` arrays, including empty arrays.
- Preserve strings exactly, including Unicode (`Durga’s Daughters`, U+2019).
- ISBNs stored as given (placeholder `978-93-5XXXX-…` format); no ISBN validation anywhere.
- No derived or "cleaned" values are written.

## 3. Accounts

| Account | Email | Role | Profile |
|---|---|---|---|
| 10 authors | The dataset email for each author | `author` | `author_id` = the author's ID; `display_name` = name |
| Admin 1 | `admin@bookleaf.test` | `admin` | display name "Ops Admin" |
| Admin 2 | `support.lead@bookleaf.test` | `admin` | display name "Support Lead" |

- Created through the Supabase Auth admin API with `email_confirm: true`. **No invitation or confirmation emails are sent** (A-11).
- Passwords come from `SEED_AUTHOR_PASSWORD` / `SEED_ADMIN_PASSWORD` (`backend/.env`, seed only). For the live demo they are published in the README for evaluators (A-05).
- Two admins make concurrent-edit and "assigned to me" behaviour demonstrable.

## 4. Script behaviour (`npm run seed`, task DB-4)

1. Validate the JSON against a zod schema; abort on any mismatch.
2. Upsert authors, then books (keyed by IDs), in one transaction.
3. Create or update auth users (keyed by email) and upsert profiles.
4. **Verify:** re-read every author and book and compare field-by-field with the JSON (nulls, numbers, arrays, strings). Print `authors 10/10 ok, books 18/18 ok` or the exact mismatches, and exit non-zero on any mismatch.
5. Never touches tickets. Demo tickets (Q-05) are a separate, opt-in script that submits through the real API.

Idempotent: re-running restores dataset values without duplicates.

## 5. Edge cases the app must handle (from this data)

| Case | Records | Expected behaviour |
|---|---|---|
| In production: null MRP/date/royalty-per-copy/partner, empty platforms | BK013, BK015 | "Not yet set" / "Not yet published" / "Not assigned yet" / "Not listed yet"; copies 0 "Not yet on sale" |
| Never paid out | BK005, BK010, BK016, BK018 | "No payout yet"; facts builder uses publication date for overdue logic |
| Pending below ₹1,000 | BK016 (₹850) | Rollover note in UI; drafts explain threshold, no payout promise |
| Fully paid | BK002, BK007, BK008, BK014 | "Fully paid" |
| Mixed author (published + in production) | AUTH007, AUTH009 | Both renderings on one page |
| Many platforms | BK004 (5 platforms incl. Amazon UK) | List wraps cleanly |
| Old book with high sales | BK011 (1,567 copies) | Number formatting `1,567` |
| Unicode title | BK017 | Renders correctly in UI, prompts and JSON |
