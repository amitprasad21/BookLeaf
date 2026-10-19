// TanStack Query setup (FRONTEND_ARCHITECTURE.md section 5).
import type { AuthorTicketListQuery } from "@bookleaf/shared";
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

export const queryKeys = {
  books: ["author", "books"] as const,
  tickets: (filters: Pick<AuthorTicketListQuery, "status">) => ["author", "tickets", filters] as const,
  ticketLists: ["author", "tickets"] as const,
  ticket: (ticketId: string) => ["author", "ticket", ticketId] as const,
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
