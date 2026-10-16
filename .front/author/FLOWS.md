# Author Flows

## F-A1. Sign in

1. Author opens the portal → redirected to `/login` if no session.
2. Enters email/password → Supabase Auth.
3. App calls `GET /me`. If `role=author` → `/books`; otherwise sign out + "This account doesn't have access to the author portal."

## F-A2. Check royalties and books

1. `/books` loads summary + books.
2. Author scans the pending figure and its caption (payout window, rollover note or fully paid).
3. Optional: expands a book for royalty per copy, print partner and platforms.
4. If something looks wrong → "Ask about this book" → F-A3 with the book pre-selected.

## F-A3. Raise a query

1. Choose the book or General → write subject/description → optionally pick a file.
2. Client validation inline. On submit, the button shows a spinner and the inputs lock.
3. `POST /author/tickets` → `201` → navigate to detail with confirmation notice.
4. Errors:
   - `400` → map field errors; focus the first invalid field.
   - `429` → "You've sent several queries recently. Please try again in {n} minutes." Text kept.
   - Network/5xx → "We couldn't send your query. Your text is still here; please try again." with requestId.
5. AI state is invisible to the author; the ticket is accepted regardless (AUTHOR-05).

## F-A4. Follow a ticket without refreshing

1. With `/tickets` or a ticket detail open, the app holds the SSE stream.
2. Admin replies → `ticket.updated` → the app refetches → the new message appears, the status badge updates, and a polite live-region announcement plays: "New reply from BookLeaf Support."
3. If the stream drops → indicator reads "Refreshing every 15 s" and polling continues until reconnection.

## F-A5. Session expiry

1. API returns `401` → the client refreshes the token once and retries.
2. Still `401` → sign out → `/login?reason=expired`. Any unsent form text is kept in `sessionStorage` and restored after sign-in.

## F-A6. Follow-up message (P2, AUTHOR-10)

1. On an Open/In progress ticket, author types a follow-up and sends.
2. `POST /author/tickets/{id}/messages` → appears in thread; admins receive `ticket.updated`.
3. On Resolved: "Reply to reopen" is a later enhancement (not in scope).
