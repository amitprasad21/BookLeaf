// TanStack Query setup (FRONTEND_ARCHITECTURE.md section 5).
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

export const queryKeys = {
  queueLists: ["admin", "queue"] as const,
  /** The list the admin is reading; changes only on filter changes, actions or "Show updates". */
  queue: (search: string) => ["admin", "queue", search] as const,
  /** Polled copy of the same list, compared with what is shown (admin/SCREENS.md M2 "Live"). */
  queueProbe: (search: string) => ["admin", "queue-probe", search] as const,
  summary: ["admin", "summary"] as const,
  ticket: (ticketId: string) => ["admin", "ticket", ticketId] as const,
  draft: (ticketId: string) => ["admin", "draft", ticketId] as const,
};

/** Polling interval while there's no live stream (API-8 adds SSE). */
export const POLL_INTERVAL_MS = 15_000;

// Retry once, and only when trying again could help (network or server errors).
const retryable = (error: unknown) =>
  !(error instanceof ApiError) || error.status === 0 || error.status >= 500;

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failures, error) => failures < 1 && retryable(error),
        refetchOnWindowFocus: true,
        staleTime: 10_000,
      },
      mutations: { retry: 0 },
    },
  });
}
