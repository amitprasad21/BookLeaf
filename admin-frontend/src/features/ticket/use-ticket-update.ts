"use client";
// PATCH /admin/tickets/{id} with the optimistic lock (FLOWS.md F-M2): send the
// version shown; on 409 show the latest ticket from `error.current` and say
// who changed it, so the admin can re-apply if still needed.
import type { AdminTicketDetailDto, UpdateTicketRequest } from "@bookleaf/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import { latestActor } from "./ticket-view";

export type TicketChanges = Omit<UpdateTicketRequest, "version">;

export function useTicketUpdate(ticket: AdminTicketDetailDto) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (changes: TicketChanges) =>
      api
        .patch<AdminTicketDetailDto>(`/admin/tickets/${ticket.id}`, { version: ticket.version, ...changes })
        .then((body) => body.data),
    onMutate: () => setMessage(null),
    onSuccess: (detail, changes) => {
      queryClient.setQueryData(queryKeys.ticket(ticket.id), detail);
      // The draft's knowledge base sections follow the category, so a shown
      // draft is fetched again (the API reuses it if nothing changed).
      if (changes.category !== undefined) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.draft(ticket.id) });
      }
    },
    onError: (error) => {
      if (isApiError(error, "VERSION_CONFLICT") && error.current) {
        const current = error.current as AdminTicketDetailDto;
        queryClient.setQueryData(queryKeys.ticket(ticket.id), current);
        setMessage({
          tone: "info",
          text: `Updated by ${latestActor(current)} just now. Showing the latest version.`,
        });
        return;
      }
      setMessage({
        tone: "error",
        text: isApiError(error) ? error.message : "We couldn't save that change. Please try again.",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.queueLists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
    },
  });

  return {
    update: (changes: TicketChanges) => mutation.mutate(changes),
    pending: mutation.isPending,
    message,
    dismiss: () => setMessage(null),
  };
}
