// Queue filters live in the URL (admin/SCREENS.md M2), so a filtered view can
// be shared, reloaded and returned to from a ticket. Pure functions.
import {
  AI_STATUSES,
  ASSIGNEE_FILTERS,
  QUEUE_SORTS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AdminQueueItemDto,
  type AiStatus,
  type TicketCategory,
  type TicketStatus,
} from "@bookleaf/shared";

export const QUEUE_PRIORITY_FILTERS = [...TICKET_PRIORITIES, "untriaged"] as const;
export type QueuePriorityFilter = (typeof QUEUE_PRIORITY_FILTERS)[number];
export type QueueSort = (typeof QUEUE_SORTS)[number];
export type AssigneeFilter = (typeof ASSIGNEE_FILTERS)[number];

export const PAGE_SIZE = 25;

export interface QueueFilters {
  /** Empty means every status. */
  status: TicketStatus[];
  category: TicketCategory[];
  priority: QueuePriorityFilter[];
  assignee: AssigneeFilter;
  aiStatus: AiStatus | null;
  overdue: boolean;
  createdFrom: string;
  createdTo: string;
  q: string;
  sort: QueueSort;
  page: number;
}

export const UNRESOLVED: TicketStatus[] = ["open", "in_progress"];

export const DEFAULT_FILTERS: QueueFilters = {
  status: UNRESOLVED,
  category: [],
  priority: [],
  assignee: "any",
  aiStatus: null,
  overdue: false,
  createdFrom: "",
  createdTo: "",
  q: "",
  sort: "urgency",
  page: 1,
};

/** In the URL, "status=all" means no status filter; no status parameter means the default. */
const ALL = "all";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function oneOf<T extends string>(allowed: readonly T[], value: string | null): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function listOf<T extends string>(allowed: readonly T[], value: string | null): T[] {
  if (!value) return [];
  const wanted = new Set(value.split(","));
  return allowed.filter((item) => wanted.has(item)); // canonical order, no duplicates
}

function statusFilter(value: string | null): TicketStatus[] {
  if (value === ALL) return [];
  const statuses = listOf(TICKET_STATUSES, value);
  return statuses.length > 0 ? statuses : UNRESOLVED; // missing or unknown: the default
}

export function filtersFromSearch(params: URLSearchParams): QueueFilters {
  const page = Number(params.get("page"));
  const date = (key: string) => {
    const value = params.get(key) ?? "";
    return ISO_DATE.test(value) ? value : "";
  };
  return {
    status: statusFilter(params.get("status")),
    category: listOf(TICKET_CATEGORIES, params.get("category")),
    priority: listOf(QUEUE_PRIORITY_FILTERS, params.get("priority")),
    assignee: oneOf(ASSIGNEE_FILTERS, params.get("assignee")) ?? "any",
    aiStatus: oneOf(AI_STATUSES, params.get("aiStatus")),
    overdue: params.get("overdue") === "true",
    createdFrom: date("createdFrom"),
    createdTo: date("createdTo"),
    q: (params.get("q") ?? "").trim().slice(0, 100),
    sort: oneOf(QUEUE_SORTS, params.get("sort")) ?? "urgency",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, index) => item === b[index]);

/** Canonical query string (defaults left out), used for the URL and as the cache key. */
export function filtersToSearch(filters: QueueFilters): string {
  const params = new URLSearchParams();
  if (!sameList(filters.status, UNRESOLVED)) {
    params.set("status", filters.status.length === 0 ? ALL : filters.status.join(","));
  }
  if (filters.category.length > 0) params.set("category", filters.category.join(","));
  if (filters.priority.length > 0) params.set("priority", filters.priority.join(","));
  if (filters.assignee !== "any") params.set("assignee", filters.assignee);
  if (filters.aiStatus) params.set("aiStatus", filters.aiStatus);
  if (filters.overdue) params.set("overdue", "true");
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  if (filters.q) params.set("q", filters.q);
  if (filters.sort !== "urgency") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params.toString();
}

/** GET /admin/tickets query parameters. */
export function apiQuery(filters: QueueFilters): Record<string, string | number | undefined> {
  return {
    status: filters.status.length > 0 ? filters.status.join(",") : undefined,
    category: filters.category.join(",") || undefined,
    priority: filters.priority.join(",") || undefined,
    assignee: filters.assignee,
    aiStatus: filters.aiStatus ?? undefined,
    overdue: filters.overdue ? "true" : undefined,
    createdFrom: filters.createdFrom || undefined,
    createdTo: filters.createdTo || undefined,
    q: filters.q || undefined,
    sort: filters.sort,
    page: filters.page,
    pageSize: PAGE_SIZE,
  };
}

/** Any filter other than the defaults (sort and page don't count). */
export function hasActiveFilters(filters: QueueFilters): boolean {
  return filtersToSearch({ ...filters, sort: "urgency", page: 1 }) !== "";
}

// ---------- Summary bar shortcuts ----------

export type Shortcut = "open" | "in_progress" | "unassigned" | "critical" | "overdue" | "manual";

/** Each summary count applies its filter (openapi.yaml QueueSummary). */
export function shortcutFilters(shortcut: Shortcut, sort: QueueSort): QueueFilters {
  const base = { ...DEFAULT_FILTERS, sort };
  switch (shortcut) {
    case "open":
      return { ...base, status: ["open"] };
    case "in_progress":
      return { ...base, status: ["in_progress"] };
    case "unassigned":
      return { ...base, assignee: "unassigned" };
    case "critical":
      return { ...base, priority: ["critical"] };
    case "overdue":
      return { ...base, overdue: true };
    case "manual":
      return { ...base, aiStatus: "manual_review_required" };
  }
}

export function isShortcutActive(shortcut: Shortcut, filters: QueueFilters): boolean {
  const target = shortcutFilters(shortcut, filters.sort);
  return filtersToSearch(target) === filtersToSearch({ ...filters, page: 1 });
}

// ---------- Live updates ----------

export interface QueueDiff {
  added: number;
  changed: number;
  removed: number;
  total: number;
}

/**
 * What a newer copy of the list would change on screen: new, changed (a new
 * version or triage state) and gone tickets. Order changes alone don't count.
 */
export function diffQueue(
  shown: readonly AdminQueueItemDto[],
  latest: readonly AdminQueueItemDto[],
): QueueDiff {
  const before = new Map(shown.map((item) => [item.id, item]));
  const after = new Set(latest.map((item) => item.id));
  let added = 0;
  let changed = 0;
  for (const item of latest) {
    const old = before.get(item.id);
    if (!old) added += 1;
    else if (old.version !== item.version || old.aiStatus !== item.aiStatus) changed += 1;
  }
  const removed = shown.filter((item) => !after.has(item.id)).length;
  return { added, changed, removed, total: added + changed + removed };
}
