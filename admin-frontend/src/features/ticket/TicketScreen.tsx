"use client";
// M3. Ticket detail (admin/SCREENS.md, STATES.md). Two columns from 1024 px
// (conversation and reply | triage, author, notes, timeline); tabs below.
// Updated by the event stream (every 15 s while it's down).
import {
  formatDateTime,
  formatRelative,
  SLOW_SERVER_HINT,
  STATUS_LABELS,
  TicketIdParamsSchema,
  type AdminTicketDetailDto,
} from "@bookleaf/shared";
import {
  ArrowLeftIcon,
  Button,
  ConfirmDialog,
  ConnectionIndicator,
  ErrorState,
  LoadingState,
  MessageThread,
  Notice,
  Panel,
  PaperclipIcon,
  PriorityBadge,
  Skeleton,
  SlaIndicator,
  StatusBadge,
  Tabs,
  Timeline,
  type ThreadItem,
} from "@bookleaf/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import { queueHref, useMediaQuery } from "@/lib/browser";
import { POLL_INTERVAL_MS, queryKeys } from "@/lib/query-client";
import { useLiveMode } from "@/providers/LiveUpdatesProvider";
import { useMe } from "@/providers/SessionProvider";
import { slaLabel } from "../queue/sla-label";
import { ContextPanel } from "./ContextPanel";
import { NotesPanel } from "./NotesPanel";
import { ReplyEditor } from "./ReplyEditor";
import { TriagePanel } from "./TriagePanel";
import { describeEvent, isUnresolved, priorityLabel } from "./ticket-view";
import { useTicketUpdate, type TicketChanges } from "./use-ticket-update";
import styles from "./ticket.module.css";

function BackLink() {
  // The queue's last filters, read once on mount (sessionStorage).
  const [href] = useState(queueHref);
  return (
    <Link href={href} className={styles.back}>
      <ArrowLeftIcon />
      Back to queue
    </Link>
  );
}

export function TicketScreen({ ticketId }: { ticketId: string }) {
  const validId = TicketIdParamsSchema.safeParse({ ticketId }).success;
  const live = useLiveMode();
  const ticket = useQuery({
    queryKey: queryKeys.ticket(ticketId),
    queryFn: ({ signal }) =>
      api.get<AdminTicketDetailDto>(`/admin/tickets/${ticketId}`, { signal }).then((body) => body.data),
    enabled: validId,
    refetchInterval: (query) => (query.state.error || live === "live" ? false : POLL_INTERVAL_MS),
  });

  if (!validId || isApiError(ticket.error, "NOT_FOUND")) {
    return (
      <>
        <h1 className="bl-sr-only">Ticket not found</h1>
        <ErrorState title="Ticket not found." action={<BackLink />} />
      </>
    );
  }
  if (ticket.isPending) {
    return (
      <LoadingState label="Loading the ticket…" slowHint={SLOW_SERVER_HINT}>
        <Skeleton width="40%" />
        <Skeleton width="70%" height="2rem" />
        <Skeleton height="12rem" />
        <Skeleton height="8rem" />
      </LoadingState>
    );
  }
  if (ticket.isError) {
    return (
      <>
        <h1 className="bl-sr-only">Ticket</h1>
        <ErrorState
          title="We couldn't load this ticket."
          description="Please try again in a moment."
          requestId={isApiError(ticket.error) ? ticket.error.requestId : null}
          onRetry={() => void ticket.refetch()}
          action={<BackLink />}
        />
      </>
    );
  }
  return <TicketView ticket={ticket.data} />;
}

function TicketView({ ticket }: { ticket: AdminTicketDetailDto }) {
  const me = useMe();
  const live = useLiveMode();
  const wide = useMediaQuery("(min-width: 1024px)");
  const { update, pending, message, dismiss } = useTicketUpdate(ticket);
  const sla = slaLabel(ticket);

  const conversation = <Conversation ticket={ticket} pending={pending} update={update} />;
  const triage = <TriagePanel ticket={ticket} me={me} pending={pending} update={update} />;
  const context = <ContextPanel ticket={ticket} />;
  const notes = <NotesPanel ticket={ticket} />;
  const timeline = <TimelinePanel ticket={ticket} />;

  return (
    <>
      <BackLink />
      <header className={styles.header}>
        <p className={styles.headerMeta}>
          <span className="bl-mono">{ticket.reference}</span>
          <StatusBadge status={ticket.status} label={STATUS_LABELS[ticket.status]} />
          <PriorityBadge priority={ticket.priority ?? "untriaged"} label={priorityLabel(ticket.priority)} />
          {sla ? <SlaIndicator state={ticket.slaState} label={sla} /> : null}
        </p>
        <h1 className={styles.title}>{ticket.subject}</h1>
        <p className={styles.headerSub}>
          {ticket.author.name} · {ticket.book?.title ?? "General / Account Level"} · Raised{" "}
          <time dateTime={ticket.createdAt} title={formatDateTime(ticket.createdAt)}>
            {formatRelative(ticket.createdAt)}
          </time>
        </p>
        <ConnectionIndicator mode={live} />
      </header>

      {message ? (
        <Notice
          tone={message.tone}
          className={styles.inlineNotice}
          actions={
            <Button size="small" variant="ghost" onClick={dismiss}>
              Dismiss
            </Button>
          }
        >
          {message.text}
        </Notice>
      ) : null}

      {wide ? (
        <div className={styles.layout}>
          <div className={styles.main}>{conversation}</div>
          <div className={styles.side}>
            {triage}
            {context}
            {notes}
            {timeline}
          </div>
        </div>
      ) : (
        <Tabs
          label="Ticket sections"
          items={[
            { id: "conversation", label: "Conversation", content: conversation },
            { id: "triage", label: "Triage", content: triage },
            { id: "context", label: "Context", content: context },
            { id: "notes", label: "Notes", content: notes },
            { id: "timeline", label: "Timeline", content: timeline },
          ]}
        />
      )}
    </>
  );
}

function Conversation({
  ticket,
  pending,
  update,
}: {
  ticket: AdminTicketDetailDto;
  pending: boolean;
  update: (changes: TicketChanges) => void;
}) {
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const thread: ThreadItem[] = [
    {
      id: "original",
      sender: ticket.author.name,
      dateTime: ticket.createdAt,
      timeLabel: formatDateTime(ticket.createdAt),
      body: ticket.description,
      own: false,
    },
    ...ticket.messages.map((message) => ({
      id: message.id,
      sender: message.senderName,
      dateTime: message.createdAt,
      timeLabel: formatDateTime(message.createdAt),
      body: message.body,
      own: message.senderRole === "admin",
    })),
  ];

  return (
    <div className={styles.stack}>
      <section aria-labelledby="conversation-heading">
        <h2 id="conversation-heading" className={styles.sectionTitle}>
          Conversation
        </h2>
        <MessageThread items={thread} label="Messages, oldest first" />
        {ticket.attachmentName ? (
          <p className={`${styles.attachment} bl-inline-icon`}>
            <PaperclipIcon />
            <span>Attachment named by the author (not uploaded): {ticket.attachmentName}</span>
          </p>
        ) : null}
      </section>

      {sent ? (
        <Notice tone="success" className={styles.inlineNotice}>
          {sent}
        </Notice>
      ) : null}

      {isUnresolved(ticket.status) ? (
        <ReplyEditor key={ticket.id} ticket={ticket} onSent={setSent} />
      ) : (
        <div className={styles.reopen}>
          <p className={styles.noticeText}>
            This ticket is {STATUS_LABELS[ticket.status].toLowerCase()}. Reopen it to reply.
          </p>
          <Button disabled={pending} onClick={() => setConfirmReopen(true)}>
            Reopen to reply
          </Button>
          <ConfirmDialog
            open={confirmReopen}
            title="Reopen this ticket?"
            description={`It moves from ${STATUS_LABELS[ticket.status]} back to In progress.`}
            confirmLabel="Reopen ticket"
            onCancel={() => setConfirmReopen(false)}
            onConfirm={() => {
              setConfirmReopen(false);
              setSent(null);
              update({ status: "in_progress" });
            }}
          />
        </div>
      )}
    </div>
  );
}

function TimelinePanel({ ticket }: { ticket: AdminTicketDetailDto }) {
  return (
    <Panel title="Timeline" headingLevel={2}>
      <Timeline
        label="Ticket history, oldest first"
        items={ticket.timeline.map((event) => ({
          id: event.id,
          text: describeEvent(event),
          actor: event.actor?.displayName ?? null,
          dateTime: event.createdAt,
          timeLabel: formatDateTime(event.createdAt),
        }))}
      />
    </Panel>
  );
}
