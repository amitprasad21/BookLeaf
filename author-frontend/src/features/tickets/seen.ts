"use client";
// "New reply" markers are tracked in this browser (author/SCREENS.md A4): when
// the author opens a ticket we remember its updatedAt; a ticket with a support
// reply that changed since then (or was never opened) is marked. The list API
// has no last-reply time, so a later status change also counts as new.
import type { AuthorTicketSummaryDto } from "@bookleaf/shared";
import { useSyncExternalStore } from "react";

const KEY = "bookleaf.author.seenTickets";
const MAX_ENTRIES = 200;

type Seen = Readonly<Record<string, string>>;

const EMPTY: Seen = {};
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: Seen = EMPTY;

function parse(raw: string | null): Seen {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    return value && typeof value === "object" ? (value as Seen) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Stable while the stored text is unchanged, as useSyncExternalStore requires. */
function snapshot(): Seen {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage); // other tabs
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function markSeen(ticketId: string, updatedAt: string) {
  const current = snapshot();
  if (current[ticketId] === updatedAt) return;
  const entries = Object.entries({ ...current, [ticketId]: updatedAt })
    .sort(([, a], [, b]) => Date.parse(b) - Date.parse(a))
    .slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    return; // storage unavailable: markers just won't persist
  }
  listeners.forEach((listener) => listener());
}

export function hasNewReply(ticket: AuthorTicketSummaryDto, seen: Seen): boolean {
  if (!ticket.hasAdminReply) return false;
  const last = seen[ticket.id];
  return last === undefined || Date.parse(ticket.updatedAt) > Date.parse(last);
}

export function useSeenTickets(): Seen {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
