"use client";
// One event stream per signed-in tab (D-032). Every event refreshes the
// polled queue copy (which feeds "Show N updates") and the summary; events
// about a ticket refresh that ticket. Drafts are never refetched by events
// (each fetch can be a model call). After any (re)connect, everything shown
// is re-fetched once in case an event was missed.
import type { TicketEvent } from "@bookleaf/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { publicConfig } from "@/lib/config";
import { runEventStream, type LiveMode } from "@/lib/event-stream";
import { queryKeys } from "@/lib/query-client";
import { getSupabase } from "@/lib/supabase";

const LiveModeContext = createContext<LiveMode>("polling");
const QUEUE_PROBES = ["admin", "queue-probe"] as const;
const TICKETS = ["admin", "ticket"] as const;

function onEvent(queryClient: QueryClient, event: TicketEvent) {
  void queryClient.invalidateQueries({ queryKey: QUEUE_PROBES });
  void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
  if (event.type !== "ticket.created") {
    void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(event.ticketId) });
  }
}

function resync(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: QUEUE_PROBES });
  void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
  void queryClient.invalidateQueries({ queryKey: TICKETS });
}

export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<LiveMode>("polling");

  useEffect(() => {
    const controller = new AbortController();
    const supabase = getSupabase();
    void runEventStream(
      {
        url: `${publicConfig().apiBaseUrl}/events`,
        getToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
        refreshSession: async () => (await supabase.auth.refreshSession()).data.session !== null,
        onEvent: (event) => onEvent(queryClient, event),
        onOpen: () => resync(queryClient),
        onMode: setMode,
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [queryClient]);

  return <LiveModeContext.Provider value={mode}>{children}</LiveModeContext.Provider>;
}

/** "live" while the stream is open; "polling" before it connects and after it drops. */
export function useLiveMode(): LiveMode {
  return useContext(LiveModeContext);
}
