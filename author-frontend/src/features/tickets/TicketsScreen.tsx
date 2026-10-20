"use client";
// A4. My Tickets (author/SCREENS.md, STATES.md). Live updates arrive over the
// event stream; while it's down the list refreshes every 15 s, and the
// indicator says which in text.
import {
  formatDateTime,
  formatRelative,
  STATUS_LABELS,
  TICKET_STATUSES,
  type AuthorTicketSummaryDto,
  type PageMeta,
  type TicketStatus,
} from "@bookleaf/shared";
import {
  Badge,
  buttonClassName,
  ChipGroup,
  ConnectionIndicator,
  DotIcon,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  PlusIcon,
  Skeleton,
  StatusBadge,
} from "@bookleaf/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import { POLL_INTERVAL_MS, queryKeys } from "@/lib/query-client";
import { GENERAL_ACCOUNT, NEW_REPLY_ANNOUNCEMENT } from "./copy";
import { useLiveMode } from "@/providers/LiveUpdatesProvider";
import { hasNewReply, useSeenTickets } from "./seen";
import styles from "./tickets.module.css";

type Filter = "all" | TicketStatus;

const FILTERS = [
  { value: "all", label: "All" },
  ...TICKET_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
] as const satisfies readonly { value: Filter; label: string }[];

const PAGE_SIZE = 100;

const isFilter = (value: string | null): value is TicketStatus =>
  value !== null && (TICKET_STATUSES as readonly string[]).includes(value);

export function TicketsScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const statusParam = params.get("status");
  const filter: Filter = isFilter(statusParam) ? statusParam : "all";
  const status = filter === "all" ? undefined : filter;
  const live = useLiveMode();

  const tickets = useQuery({
    queryKey: queryKeys.tickets({ status: status ? [status] : undefined }),
    queryFn: ({ signal }) =>
      api.get<AuthorTicketSummaryDto[], PageMeta>("/author/tickets", {
        query: { status, pageSize: PAGE_SIZE },
        signal,
      }),
    refetchInterval: live === "live" ? false : POLL_INTERVAL_MS, // events refresh it while live
  });
  const seen = useSeenTickets();

  // Announce replies that arrive while the list is open.
  const [announcement, setAnnouncement] = useState("");
  const newReplies = (tickets.data?.data ?? []).filter((ticket) => hasNewReply(ticket, seen)).length;
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (!tickets.data) return;
    if (previous.current !== null && newReplies > previous.current) setAnnouncement(NEW_REPLY_ANNOUNCEMENT);
    previous.current = newReplies;
  }, [tickets.data, newReplies]);

  const setFilter = (value: Filter) => {
    previous.current = null;
    router.replace(value === "all" ? pathname : `${pathname}?status=${value}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="My Tickets"
        actions={
          <>
            <ConnectionIndicator mode={live} />
            <Link href="/tickets/new" className={buttonClassName({ variant: "primary" })}>
              <PlusIcon />
              Raise a query
            </Link>
          </>
        }
      />
      <p className="bl-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <div className={styles.filters}>
        <ChipGroup label="Filter by status" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      {tickets.isPending ? (
        <LoadingState label="Loading your queries…">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} height="3.5rem" />
          ))}
        </LoadingState>
      ) : tickets.isError ? (
        <ErrorState
          title="We couldn't load your queries."
          description="Please try again in a moment."
          requestId={isApiError(tickets.error) ? tickets.error.requestId : null}
          onRetry={() => void tickets.refetch()}
        />
      ) : tickets.data.data.length === 0 ? (
        filter === "all" ? (
          <EmptyState
            title="You haven't raised any queries yet."
            action={
              <Link href="/tickets/new" className={buttonClassName({ variant: "primary" })}>
                Raise a query
              </Link>
            }
          />
        ) : (
          <EmptyState
            title={`No ${STATUS_LABELS[filter].toLowerCase()} queries.`}
            action={
              <button type="button" className={buttonClassName()} onClick={() => setFilter("all")}>
                Show all
              </button>
            }
          />
        )
      ) : (
        <TicketList tickets={tickets.data.data} total={tickets.data.meta?.total} seen={seen} />
      )}
    </>
  );
}

function NewReply() {
  return (
    <Badge variant="strong" icon={<DotIcon size={12} />}>
      New reply
    </Badge>
  );
}

function Updated({ value }: { value: string }) {
  return (
    <time dateTime={value} title={formatDateTime(value)}>
      Updated {formatRelative(value)}
    </time>
  );
}

function TicketList({
  tickets,
  total,
  seen,
}: {
  tickets: AuthorTicketSummaryDto[];
  total: number | undefined;
  seen: Readonly<Record<string, string>>;
}) {
  return (
    <>
      <div className={styles.tableView}>
        <div className="bl-table-wrap">
          <table className="bl-table">
            <caption className="bl-sr-only">Your queries, most recently updated first</caption>
            <thead>
              <tr>
                <th scope="col">Query</th>
                <th scope="col">Book</th>
                <th scope="col">Status</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className={styles.row}>
                  <td>
                    <Link href={`/tickets/${ticket.id}`} className={styles.rowLink}>
                      {ticket.subject}
                    </Link>
                    <span className={styles.reference}>
                      <span className="bl-mono">{ticket.reference}</span>
                      {hasNewReply(ticket, seen) ? <NewReply /> : null}
                    </span>
                  </td>
                  <td>{ticket.book?.title ?? GENERAL_ACCOUNT}</td>
                  <td>
                    <StatusBadge status={ticket.status} label={STATUS_LABELS[ticket.status]} />
                  </td>
                  <td className={styles.updated}>
                    <Updated value={ticket.updatedAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ul className={styles.cardView}>
        {tickets.map((ticket) => (
          <li key={ticket.id} className={styles.card}>
            <Link href={`/tickets/${ticket.id}`} className={styles.rowLink}>
              {ticket.subject}
            </Link>
            <p className={styles.reference}>
              <span className="bl-mono">{ticket.reference}</span>
              <StatusBadge status={ticket.status} label={STATUS_LABELS[ticket.status]} />
              {hasNewReply(ticket, seen) ? <NewReply /> : null}
            </p>
            <p className={styles.cardMeta}>
              {ticket.book?.title ?? GENERAL_ACCOUNT} · <Updated value={ticket.updatedAt} />
            </p>
          </li>
        ))}
      </ul>

      {total !== undefined && total > tickets.length ? (
        <p className={styles.more}>
          Showing your {tickets.length} most recently updated queries of {total}.
        </p>
      ) : null}
    </>
  );
}
