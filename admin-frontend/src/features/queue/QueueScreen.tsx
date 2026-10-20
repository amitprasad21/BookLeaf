"use client";
// M2. Queue (admin/SCREENS.md, STATES.md, FLOWS.md F-M1). Filters live in the
// URL. The shown list changes only on the admin's own actions; a second copy,
// refreshed by live events (or every 15 s while the stream is down), offers
// "Show N updates" instead of reordering rows under their eyes.
import {
  AI_STATUS_LABELS,
  CATEGORY_LABELS,
  formatDateTime,
  formatRelative,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  UNTRIAGED_LABEL,
  type AdminQueueItemDto,
  type AdminTicketDetailDto,
  type PageMeta,
  type QueueSummaryDto,
  type ValueSource,
} from "@bookleaf/shared";
import {
  Badge,
  Button,
  CheckboxGroup,
  CircleDotIcon,
  ConnectionIndicator,
  Disclosure,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  PageHeader,
  Pagination,
  PersonIcon,
  PriorityBadge,
  RefreshIcon,
  Select,
  Skeleton,
  SlaIndicator,
  SpinnerIcon,
  StatusBadge,
  TextField,
} from "@bookleaf/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, isApiError } from "@/lib/api-client";
import { rememberQueueSearch, useMediaQuery } from "@/lib/browser";
import { POLL_INTERVAL_MS, queryKeys } from "@/lib/query-client";
import { useLiveMode } from "@/providers/LiveUpdatesProvider";
import { useMe } from "@/providers/SessionProvider";
import {
  apiQuery,
  DEFAULT_FILTERS,
  diffQueue,
  filtersFromSearch,
  filtersToSearch,
  hasActiveFilters,
  isShortcutActive,
  PAGE_SIZE,
  QUEUE_PRIORITY_FILTERS,
  shortcutFilters,
  type QueueFilters,
  type QueueSort,
  type Shortcut,
} from "./queue-params";
import { slaLabel } from "./sla-label";
import styles from "./queue.module.css";

type QueuePage = { data: AdminQueueItemDto[]; meta?: PageMeta };

const SORT_OPTIONS: { value: QueueSort; label: string }[] = [
  { value: "urgency", label: "Most urgent" },
  { value: "-created_at", label: "Newest" },
  { value: "created_at", label: "Oldest" },
  { value: "-updated_at", label: "Recently updated" },
];

const SHORTCUTS: { id: Shortcut; label: string; count: (summary: QueueSummaryDto) => number }[] = [
  { id: "open", label: "Open", count: (summary) => summary.open },
  { id: "in_progress", label: "In progress", count: (summary) => summary.inProgress },
  { id: "unassigned", label: "Unassigned", count: (summary) => summary.unassigned },
  { id: "critical", label: "Critical", count: (summary) => summary.critical },
  { id: "overdue", label: "Overdue", count: (summary) => summary.slaBreached },
  { id: "manual", label: "Needs manual triage", count: (summary) => summary.needsManualTriage },
];

const PRIORITY_FILTER_LABELS = { ...PRIORITY_LABELS, untriaged: UNTRIAGED_LABEL };

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export function QueueScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const me = useMe();
  const wide = useMediaQuery("(min-width: 1024px)");
  const live = useLiveMode();
  const poll = live === "live" ? false : POLL_INTERVAL_MS; // events refresh the copy while live

  const filters = filtersFromSearch(params);
  const search = filtersToSearch(filters);
  useEffect(() => rememberQueueSearch(search), [search]);

  const fetchPage = (signal: AbortSignal) =>
    api.get<AdminQueueItemDto[], PageMeta>("/admin/tickets", { query: apiQuery(filters), signal });

  const list = useQuery({
    queryKey: queryKeys.queue(search),
    queryFn: ({ signal }) => fetchPage(signal),
    refetchOnWindowFocus: false,
  });
  const probe = useQuery({
    queryKey: queryKeys.queueProbe(search),
    queryFn: ({ signal }) => fetchPage(signal),
    refetchInterval: poll,
    enabled: list.isSuccess,
  });
  const summary = useQuery({
    queryKey: queryKeys.summary,
    queryFn: ({ signal }) =>
      api.get<QueueSummaryDto>("/admin/tickets/summary", { signal }).then((body) => body.data),
    refetchInterval: poll,
  });

  // Tickets created after the admin opened the queue get a "New" tag.
  const [openedAt] = useState(() => Date.now());

  const updates =
    list.data && probe.data && probe.dataUpdatedAt > list.dataUpdatedAt
      ? diffQueue(list.data.data, probe.data.data)
      : null;
  const showUpdates = () => {
    if (probe.data) queryClient.setQueryData<QueuePage>(queryKeys.queue(search), probe.data);
  };

  const [notice, setNotice] = useState<string | null>(null);
  const assign = useMutation({
    mutationFn: (ticket: AdminQueueItemDto) =>
      api.patch<AdminTicketDetailDto>(`/admin/tickets/${ticket.id}`, {
        version: ticket.version,
        assignedAdminId: me.userId,
      }),
    onMutate: () => setNotice(null),
    onError: (error) =>
      setNotice(
        isApiError(error, "VERSION_CONFLICT")
          ? "That ticket changed a moment ago, so the list has been refreshed."
          : isApiError(error)
            ? error.message
            : "We couldn't assign that ticket. Please try again.",
      ),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.queueLists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
    },
  });

  function apply(next: QueueFilters) {
    const query = filtersToSearch(next);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }
  const change = (patch: Partial<QueueFilters>) => apply({ ...filters, ...patch, page: 1 });

  const total = list.data?.meta?.total ?? 0;

  return (
    <>
      <PageHeader title="Ticket queue" actions={<ConnectionIndicator mode={live} />} />

      <SummaryBar
        summary={summary.data}
        filters={filters}
        onShortcut={(id) => apply(shortcutFilters(id, filters.sort))}
      />

      {wide ? (
        <section aria-label="Filters" className={styles.filters}>
          <FilterForm
            key={filters.q}
            filters={filters}
            onChange={change}
            onClear={() => apply({ ...DEFAULT_FILTERS, sort: filters.sort })}
          />
        </section>
      ) : (
        <Disclosure
          summary={hasActiveFilters(filters) ? "Filters (applied)" : "Filters"}
          className={styles.filterDisclosure}
        >
          <div className={styles.filters}>
            <FilterForm
              key={filters.q}
              filters={filters}
              onChange={change}
              onClear={() => apply({ ...DEFAULT_FILTERS, sort: filters.sort })}
            />
          </div>
        </Disclosure>
      )}

      <div className={styles.toolbar}>
        <div className={styles.sort}>
          <Select
            label="Sort"
            value={filters.sort}
            onChange={(event) => change({ sort: event.target.value as QueueSort })}
            hint={filters.sort === "urgency" ? "Unresolved first, then priority, then oldest." : undefined}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <p className={styles.count} aria-live="polite" aria-atomic="true">
          {list.data ? plural(total, "ticket") : ""}
        </p>
        {updates && updates.total > 0 ? (
          <Button icon={<RefreshIcon />} onClick={showUpdates}>
            Show {plural(updates.total, "update")}
          </Button>
        ) : null}
      </div>
      <p className="bl-sr-only" aria-live="polite" aria-atomic="true">
        {updates && updates.added > 0 ? `${plural(updates.added, "new ticket")}` : ""}
      </p>

      {notice ? (
        <Notice tone="warning" className={styles.notice}>
          {notice}
        </Notice>
      ) : null}

      {list.isPending ? (
        <LoadingState label="Loading the queue…">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} height="3rem" />
          ))}
        </LoadingState>
      ) : list.isError ? (
        <ErrorState
          title="We couldn't load the queue."
          description="Please try again in a moment."
          requestId={isApiError(list.error) ? list.error.requestId : null}
          onRetry={() => void list.refetch()}
        />
      ) : list.data.data.length === 0 ? (
        hasActiveFilters(filters) ? (
          <EmptyState
            title="No tickets match these filters."
            action={
              <Button onClick={() => apply({ ...DEFAULT_FILTERS, sort: filters.sort })}>Clear filters</Button>
            }
          />
        ) : (
          <EmptyState
            title="No tickets yet."
            description="New author queries will appear here automatically."
          />
        )
      ) : (
        <>
          <QueueList
            tickets={list.data.data}
            openedAt={openedAt}
            assigning={assign.isPending ? assign.variables?.id : undefined}
            onAssign={(ticket) => assign.mutate(ticket)}
          />
          <Pagination
            page={filters.page}
            pageSize={PAGE_SIZE}
            total={total}
            onPage={(page) => apply({ ...filters, page })}
          />
        </>
      )}
    </>
  );
}

function SummaryBar({
  summary,
  filters,
  onShortcut,
}: {
  summary: QueueSummaryDto | undefined;
  filters: QueueFilters;
  onShortcut: (shortcut: Shortcut) => void;
}) {
  return (
    <div role="group" aria-label="Queue summary" className={styles.summary}>
      {SHORTCUTS.map((shortcut) => (
        <button
          key={shortcut.id}
          type="button"
          className={styles.summaryItem}
          aria-pressed={isShortcutActive(shortcut.id, filters)}
          onClick={() => onShortcut(shortcut.id)}
        >
          <span className={styles.summaryCount}>{summary ? shortcut.count(summary) : "–"}</span>
          <span className={styles.summaryLabel}>{shortcut.label}</span>
        </button>
      ))}
    </div>
  );
}

function FilterForm({
  filters,
  onChange,
  onClear,
}: {
  filters: QueueFilters;
  onChange: (patch: Partial<QueueFilters>) => void;
  onClear: () => void;
}) {
  // Search applies on submit, not on every keystroke.
  const [text, setText] = useState(filters.q);
  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onChange({ q: text.trim() });
  };

  return (
    <div className={styles.filterGrid}>
      <form role="search" className={styles.search} onSubmit={onSearch}>
        <TextField
          label="Search"
          type="search"
          hint="Reference, subject or author name"
          value={text}
          maxLength={100}
          onChange={(event) => setText(event.target.value)}
        />
        <Button type="submit">Search</Button>
      </form>
      <CheckboxGroup
        legend="Status"
        options={TICKET_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
        values={filters.status}
        onChange={(status) => onChange({ status })}
      />
      <CheckboxGroup
        legend="Priority"
        options={QUEUE_PRIORITY_FILTERS.map((value) => ({ value, label: PRIORITY_FILTER_LABELS[value] }))}
        values={filters.priority}
        onChange={(priority) => onChange({ priority })}
      />
      <CheckboxGroup
        legend="Category"
        options={TICKET_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
        values={filters.category}
        onChange={(category) => onChange({ category })}
      />
      <div className={styles.filterRow}>
        <Select
          label="Assignee"
          value={filters.assignee}
          onChange={(event) => onChange({ assignee: event.target.value as QueueFilters["assignee"] })}
        >
          <option value="any">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </Select>
        <TextField
          label="Created from"
          type="date"
          value={filters.createdFrom}
          max={filters.createdTo || undefined}
          onChange={(event) => onChange({ createdFrom: event.target.value })}
        />
        <TextField
          label="Created to"
          type="date"
          value={filters.createdTo}
          min={filters.createdFrom || undefined}
          onChange={(event) => onChange({ createdTo: event.target.value })}
        />
      </div>
      {filters.overdue || filters.aiStatus ? (
        <p className={styles.extraFilters}>
          Also showing only:{" "}
          {[
            filters.overdue && "overdue",
            filters.aiStatus && AI_STATUS_LABELS[filters.aiStatus].toLowerCase(),
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
      ) : null}
      <div>
        <Button variant="ghost" onClick={onClear} disabled={!hasActiveFilters(filters)}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}

function SourceIcon({ source }: { source: ValueSource | null }) {
  if (source === "ai") return <CircleDotIcon size={14} title="AI suggestion" />;
  if (source === "admin") return <PersonIcon size={14} title="Set by admin" />;
  return null;
}

function AiCell({ ticket }: { ticket: AdminQueueItemDto }) {
  if (ticket.aiStatus === "pending") {
    return (
      <span className="bl-inline-icon bl-muted">
        <SpinnerIcon />
        {AI_STATUS_LABELS.pending}
      </span>
    );
  }
  if (ticket.aiStatus === "manual_review_required") return <Badge variant="dashed">Manual</Badge>;
  if (ticket.aiStatus === "failed") return <span className="bl-muted">{AI_STATUS_LABELS.failed}</span>;
  return <span className="bl-sr-only">{AI_STATUS_LABELS.completed}</span>;
}

function Age({ ticket }: { ticket: AdminQueueItemDto }) {
  const sla = slaLabel(ticket);
  return (
    <>
      <time dateTime={ticket.createdAt} title={formatDateTime(ticket.createdAt)}>
        {formatRelative(ticket.createdAt)}
      </time>
      {sla ? (
        <span className={styles.block}>
          <SlaIndicator state={ticket.slaState} label={sla} />
        </span>
      ) : null}
    </>
  );
}

function Assignee({
  ticket,
  assigning,
  onAssign,
}: {
  ticket: AdminQueueItemDto;
  assigning: boolean;
  onAssign: () => void;
}) {
  if (ticket.assignedAdmin) return <>{ticket.assignedAdmin.displayName}</>;
  const open = ticket.status === "open" || ticket.status === "in_progress";
  return (
    <>
      <span className="bl-muted">Unassigned</span>
      {open ? (
        <span className={styles.block}>
          <Button
            size="small"
            className={styles.rowAction}
            loading={assigning}
            loadingLabel="Assigning…"
            onClick={onAssign}
          >
            Assign to me<span className="bl-sr-only">: {ticket.reference}</span>
          </Button>
        </span>
      ) : null}
    </>
  );
}

function QueueList({
  tickets,
  openedAt,
  assigning,
  onAssign,
}: {
  tickets: AdminQueueItemDto[];
  openedAt: number;
  assigning: string | undefined;
  onAssign: (ticket: AdminQueueItemDto) => void;
}) {
  const isNew = (ticket: AdminQueueItemDto) => Date.parse(ticket.createdAt) > openedAt;
  const priority = (ticket: AdminQueueItemDto) => (
    <span className="bl-inline-icon">
      <PriorityBadge
        priority={ticket.priority ?? "untriaged"}
        label={ticket.priority ? PRIORITY_LABELS[ticket.priority] : UNTRIAGED_LABEL}
      />
      <SourceIcon source={ticket.prioritySource} />
    </span>
  );

  return (
    <>
      <div className={styles.tableView}>
        <div className="bl-table-wrap">
          <table className="bl-table">
            <caption className="bl-sr-only">Tickets</caption>
            <thead>
              <tr>
                <th scope="col">Priority</th>
                <th scope="col">Ticket</th>
                <th scope="col">Author</th>
                <th scope="col">Category</th>
                <th scope="col">Status</th>
                <th scope="col">Age</th>
                <th scope="col">Assignee</th>
                <th scope="col">AI</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id} className={styles.row}>
                  <td>{priority(ticket)}</td>
                  <td className={styles.ticketCell}>
                    <span className={styles.reference}>
                      <span className="bl-mono">{ticket.reference}</span>
                      {isNew(ticket) ? <Badge variant="strong">New</Badge> : null}
                    </span>
                    <Link href={`/tickets/${ticket.id}`} className={styles.rowLink}>
                      {ticket.subject}
                    </Link>
                  </td>
                  <td>
                    {ticket.author.name}
                    <span className={styles.caption}>{ticket.book?.title ?? "General"}</span>
                  </td>
                  <td>
                    {ticket.category ? (
                      <span className="bl-inline-icon">
                        {CATEGORY_LABELS[ticket.category]}
                        <SourceIcon source={ticket.categorySource} />
                      </span>
                    ) : (
                      <span className="bl-muted">Not set</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={ticket.status} label={STATUS_LABELS[ticket.status]} />
                  </td>
                  <td className={styles.nowrap}>
                    <Age ticket={ticket} />
                  </td>
                  <td>
                    <Assignee
                      ticket={ticket}
                      assigning={assigning === ticket.id}
                      onAssign={() => onAssign(ticket)}
                    />
                  </td>
                  <td>
                    <AiCell ticket={ticket} />
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
            <div className={styles.cardTop}>
              {priority(ticket)}
              <StatusBadge status={ticket.status} label={STATUS_LABELS[ticket.status]} />
              {isNew(ticket) ? <Badge variant="strong">New</Badge> : null}
            </div>
            <Link href={`/tickets/${ticket.id}`} className={styles.rowLink}>
              {ticket.subject}
            </Link>
            <p className={styles.cardMeta}>
              <span className="bl-mono">{ticket.reference}</span> · {ticket.author.name} ·{" "}
              <Age ticket={ticket} />
            </p>
            <div className={styles.cardMeta}>
              <Assignee
                ticket={ticket}
                assigning={assigning === ticket.id}
                onAssign={() => onAssign(ticket)}
              />
            </div>
            <div className={styles.cardMeta}>
              <AiCell ticket={ticket} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
