// Queue filters in the URL, summary shortcuts and live-update diffs (admin/SCREENS.md M2).
import type { AdminQueueItemDto } from "@bookleaf/shared";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  apiQuery,
  diffQueue,
  filtersFromSearch,
  filtersToSearch,
  hasActiveFilters,
  isShortcutActive,
  shortcutFilters,
} from "./queue-params";

const parse = (search: string) => filtersFromSearch(new URLSearchParams(search));

describe("filters in the URL", () => {
  it("defaults to unresolved tickets, most urgent first, page 1", () => {
    expect(parse("")).toEqual(DEFAULT_FILTERS);
    expect(filtersToSearch(DEFAULT_FILTERS)).toBe("");
  });

  it("round-trips every filter in a canonical order", () => {
    const search =
      "status=resolved%2Copen&category=isbn_metadata&priority=untriaged%2Ccritical&assignee=me&aiStatus=failed&overdue=true&createdFrom=2026-10-01&createdTo=2026-10-19&q=Priya&sort=-created_at&page=3";
    const filters = parse(search);
    expect(filters).toMatchObject({
      status: ["open", "resolved"],
      priority: ["critical", "untriaged"],
      assignee: "me",
      overdue: true,
      page: 3,
    });
    expect(parse(filtersToSearch(filters))).toEqual(filters);
  });

  it("uses status=all for no status filter", () => {
    expect(parse("status=all").status).toEqual([]);
    expect(filtersToSearch({ ...DEFAULT_FILTERS, status: [] })).toBe("status=all");
  });

  it("ignores values it doesn't know", () => {
    expect(
      parse("status=nope&priority=urgent&assignee=bob&sort=random&page=-2&createdFrom=19-10-2026"),
    ).toEqual(DEFAULT_FILTERS);
  });

  it("builds the API query", () => {
    expect(apiQuery(parse("priority=critical&q=royalty"))).toEqual({
      status: "open,in_progress",
      category: undefined,
      priority: "critical",
      assignee: "any",
      aiStatus: undefined,
      overdue: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      q: "royalty",
      sort: "urgency",
      page: 1,
      pageSize: 25,
    });
    expect(apiQuery(parse("status=all")).status).toBeUndefined();
  });

  it("knows when filters are applied (sort and page don't count)", () => {
    expect(hasActiveFilters(parse("sort=created_at&page=2"))).toBe(false);
    expect(hasActiveFilters(parse("assignee=unassigned"))).toBe(true);
  });
});

describe("summary shortcuts", () => {
  it("apply the openapi QueueSummary filters and keep the sort", () => {
    expect(filtersToSearch(shortcutFilters("open", "urgency"))).toBe("status=open");
    expect(filtersToSearch(shortcutFilters("unassigned", "-created_at"))).toBe(
      "assignee=unassigned&sort=-created_at",
    );
    expect(filtersToSearch(shortcutFilters("overdue", "urgency"))).toBe("overdue=true");
    expect(filtersToSearch(shortcutFilters("manual", "urgency"))).toBe("aiStatus=manual_review_required");
  });

  it("show as pressed only for exactly their filter", () => {
    expect(isShortcutActive("critical", parse("priority=critical&page=2"))).toBe(true);
    expect(isShortcutActive("critical", parse("priority=critical&assignee=me"))).toBe(false);
  });
});

describe("diffQueue", () => {
  const item = (id: string, version = 1, aiStatus: AdminQueueItemDto["aiStatus"] = "completed") =>
    ({ id, version, aiStatus }) as AdminQueueItemDto;

  it("counts new, changed and gone tickets", () => {
    const shown = [item("a"), item("b"), item("c")];
    const latest = [item("d"), item("a", 2), item("b")];
    expect(diffQueue(shown, latest)).toEqual({ added: 1, changed: 1, removed: 1, total: 3 });
  });

  it("ignores a new order and counts a finished triage", () => {
    expect(diffQueue([item("a"), item("b")], [item("b"), item("a")]).total).toBe(0);
    expect(diffQueue([item("a", 1, "pending")], [item("a", 1, "completed")]).changed).toBe(1);
  });
});
