"use client";
// Small browser helpers. Every storage call tolerates blocked storage.
import { useSyncExternalStore } from "react";

/** Whether a media query matches, following changes (false before hydration). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the feature just doesn't persist.
  }
}

const QUEUE_SEARCH_KEY = "bookleaf.admin.queueSearch";

/** The queue's last query string, so "Back to queue" keeps the filters. */
export function rememberQueueSearch(search: string) {
  writeSession(QUEUE_SEARCH_KEY, search);
}

export function queueHref(): string {
  const search = readSession(QUEUE_SEARCH_KEY);
  return search ? `/tickets?${search}` : "/tickets";
}
