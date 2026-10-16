# Design System (Provisional Monochrome)

**Owns:** every visual token and rule. No other file may define colours, fonts, spacing or radii.
**Status: PROVISIONAL.** The canonical monochrome UI specification (S-07) was not provided. These tokens follow the rules the blueprint quotes from it and will be replaced when it arrives (D-014). Components consume tokens only, so swapping values does not change component code.

## 1. Rules

1. Monochrome only: black, white and grays. No brand colours, gradients, glows, glassmorphism, shadows or decorative imagery.
2. Opaque surfaces separated by borders, not shadows.
3. Every interactive control has a visible boundary (≥ 3:1 against its background) and a visible focus indicator.
4. Meaning is never carried by colour (or shade) alone. Always pair it with text and/or an icon.
5. No fake data. Unknown or not-yet-applicable values use the null-value wording in §7, never `0` or `₹0`.

## 2. Colour tokens (dark theme)

| Token | Value | Use | Contrast note |
|---|---|---|---|
| `--color-bg` | `#0B0B0B` | Page background | n/a |
| `--color-surface` | `#141414` | Panels, cards, table body | n/a |
| `--color-surface-raised` | `#1C1C1C` | Hover rows, menus, dialogs | n/a |
| `--color-surface-inverse` | `#F5F5F5` | Primary buttons, Critical badge | n/a |
| `--color-text` | `#F5F5F5` | Primary text | ≈ 18:1 on bg |
| `--color-text-muted` | `#A3A3A3` | Secondary text, labels | ≈ 7.8:1 on bg, ≈ 7.3:1 on surface |
| `--color-text-subtle` | `#8A8A8A` | Metadata, timestamps | ≈ 5.3:1 on surface (≥ 4.5 required) |
| `--color-text-inverse` | `#0B0B0B` | Text on inverse surfaces | ≈ 18:1 |
| `--color-border-control` | `#6B6B6B` | Inputs, buttons, badges | ≈ 3.7:1 on bg (≥ 3 required) |
| `--color-border-strong` | `#A3A3A3` | Hover/active control borders, High badge | ≈ 7.8:1 |
| `--color-border-subtle` | `#2A2A2A` | Decorative dividers only (never the only boundary of a control) | n/a |
| `--color-focus` | `#FFFFFF` | Focus outline | Maximum |
| `--color-disabled-text` | `#6B6B6B` | Disabled controls (exempt from contrast, still labelled) | n/a |

Contrast values are calculated from the WCAG formula and must be re-checked with a tool in QA-1.

## 3. Typography

- Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`.
- Monospace (references, ISBNs): `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `--text-xs` | 12 / 16 | 400 | Badges, captions |
| `--text-sm` | 14 / 20 | 400 | Tables, metadata, helper text |
| `--text-md` | 16 / 24 | 400 | Body, inputs (prevents iOS zoom) |
| `--text-lg` | 20 / 28 | 600 | Section titles |
| `--text-xl` | 24 / 32 | 600 | Page titles |
| `--text-2xl` | 32 / 40 | 700 | Key figures (royalty summary) |

## 4. Spacing, radius, layout

- Spacing scale: `4, 8, 12, 16, 24, 32, 48, 64` px (`--space-1` … `--space-8`).
- Radius: `--radius-control: 4px`, `--radius-panel: 8px`.
- Borders: 1px default; 2px for High priority and focused states.
- Max content width: 1200px (author), fluid with 1440px cap (admin queue).
- Breakpoints: `sm 480`, `md 768`, `lg 1024`, `xl 1280`.
- Minimum touch target: 44 × 44 px.

## 5. Focus and motion

- Focus: `outline: 2px solid var(--color-focus); outline-offset: 2px` on every focusable element via `:focus-visible`.
- Motion: 150 ms ease for hover/press only; disabled under `prefers-reduced-motion: reduce`.

## 6. Status, priority and source encodings (no colour reliance)

| Concept | Value | Visual | Text |
|---|---|---|---|
| Ticket status | Open | Hollow circle icon | "Open" |
| | In Progress | Half-filled circle icon | "In progress" |
| | Resolved | Check icon | "Resolved" |
| | Closed | Lock icon, muted text | "Closed" |
| Priority | Critical | **Inverse** badge (light fill, dark text) + double-chevron-up icon | "Critical" |
| | High | 2px strong border + chevron-up icon | "High" |
| | Medium | 1px control border | "Medium" |
| | Low | Muted text, no border | "Low" |
| | Untriaged | Dashed border | "Needs triage" |
| Value source | AI | "AI" tag with sparkle-free plain icon (circle-dot) | "AI suggestion" (+ confidence %) |
| | Admin | "Admin" tag with person icon | "Set by admin" |
| First response | Breached | Clock icon + bold | "Overdue · 6h" |
| | Due soon | Clock icon | "Due in 1h" |
| Live updates | Connected / polling | Dot icon + text | "Live" / "Refreshing every 15 s" |

Icons are inline SVGs in `packages/ui` (no icon dependency), each with `aria-hidden="true"` when text is present.

## 7. Data formatting and null wording

| Data | Format | Null / empty wording |
|---|---|---|
| Money | `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })` → `₹11,970` | MRP / royalty per copy: "Not yet set" |
| Dates | `en-IN`, `20 Jun 2023` (table), `20 June 2023` (prose) | Publication date: "Not yet published"; last payout: "No payout yet" |
| Timestamps | Relative in lists ("3 h ago") with absolute in `title`/tooltip and on detail pages | n/a |
| Counts | `en-IN` grouping (`1,567`) | Copies sold for unpublished books: `0` with caption "Not yet on sale" |
| Print partner | as stored | "Not assigned yet" |
| Platforms | comma list | "Not listed yet" |
| ISBN | monospace, as stored | n/a (always present) |
| Pending royalty = 0 with earnings > 0 | `₹0` + "Fully paid" | n/a |
| 0 < pending < ₹1,000 | amount + note "Below ₹1,000 payout minimum; rolls over to next quarter" | n/a |
