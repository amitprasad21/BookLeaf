# Components

**Owns:** the shared component inventory in `packages/ui`, their variants and required states. Styling comes only from [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) tokens.

**Build status (FE-1, D-031):** built: `AppShell`, `NavBar`, `Button`, `TextField`/`TextArea`, `Select`, `FileInput`, `Badge`, `StatusBadge`, `PriorityBadge`, `SourceTag`, `Panel`, `Notice`, `EmptyState`, `LoadingState`, `ErrorState`, `MessageThread`, `ConnectionIndicator`, `KeyFigure`, plus `PageHeader`, `ChipGroup` (status filter chips) and `Disclosure`. Tables use the `bl-table` classes. `MoneyValue`/`DateValue` are the shared formatters in `packages/shared` (`formatInr`, `formatDate`, `NULL_WORDING`), since `packages/ui` takes wording from callers. Still to build with the admin portal (FE-M1..M4): sortable `Table`, `FilterBar`, `Pagination`, `Dialog`, `Tabs`, `ReplyEditor`, `Timeline`, `SlaIndicator`.

| Component | Variants / props | Required states | Accessibility notes |
|---|---|---|---|
| `AppShell` | `portal: author \| admin` | n/a | Skip link to main; landmark roles (`header`, `nav`, `main`) |
| `NavBar` | links, account menu | active link | `aria-current="page"` |
| `Button` | `primary` (inverse fill), `secondary` (outlined), `ghost`, `danger` (outlined + icon, always confirmed) | default, hover, focus, active, disabled, loading | Loading keeps width, sets `aria-busy`; disabled buttons explain why via adjacent text when non-obvious |
| `TextField` / `TextArea` | label, hint, error, counter | default, focus, error, disabled | `<label for>`; error linked via `aria-describedby`; counter announced politely near the limit |
| `Select` | native `<select>` | default, focus, error | Native for accessibility and mobile |
| `FileInput` | accept list, max size | empty, selected, error | Clearly says "Upload not enabled in this version; filename is recorded" (D-015) |
| `Badge` | base for status/priority/source | n/a | Text always present |
| `StatusBadge` | 4 statuses | n/a | Icon `aria-hidden`, text label |
| `PriorityBadge` | 4 priorities + untriaged | n/a | Encoding per DESIGN_SYSTEM §6 |
| `SourceTag` | `ai` (with confidence), `admin` | n/a | "AI suggestion · 82% confident" / "Set by admin" |
| `SlaIndicator` | breached, due soon, on track, met | n/a | Text first ("Overdue · 6h") |
| `Table` | sortable columns, row link | loading (skeleton rows), empty, error | `<table>` semantics, `aria-sort` on sorted header, whole-row link via a real `<a>` in the first cell |
| `FilterBar` | multi-selects, date range, search | applied, cleared | Each control labelled; "Clear filters" button; result count announced |
| `Pagination` | page, pageSize, total | first/last disabled | `nav aria-label="Pagination"` |
| `Panel` | title, actions | n/a | Heading level passed in |
| `Notice` | `info`, `warning`, `success`, `error` | n/a | Icon + text; `role="status"` (polite) or `role="alert"` (errors) |
| `EmptyState` | title, description, action | n/a | Action is a real link/button |
| `LoadingState` | skeleton lines/table | n/a | `aria-busy` on container; text "Loading…" for screen readers |
| `ErrorState` | message, retry, requestId | n/a | Focus moves to the heading on render |
| `Dialog` | confirm / form | open, closing | Focus trap, `Esc` closes, returns focus to trigger |
| `Tabs` | used on small screens for ticket detail | selected | WAI-ARIA tabs pattern |
| `MessageThread` | author/admin messages | empty (no replies yet) | Ordered list; each item has sender, time; text rendered as plain text with line breaks |
| `ReplyEditor` | value, draft meta, warnings, send menu | empty, AI loading, AI ready, AI unavailable, sending, sent, error | Warnings above field; Send requires non-empty text; "Send & resolve" secondary |
| `Timeline` | events | empty | Ordered list with actor + time |
| `MoneyValue` | number \| null, nullLabel | null | Uses shared formatter |
| `DateValue` | string \| null, nullLabel, relative | null | `<time datetime>` |
| `ConnectionIndicator` | live / polling | n/a | `role="status"` |
| `KeyFigure` | label, value, caption | null | For royalty summary |
