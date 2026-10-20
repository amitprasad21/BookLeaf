"use client";
// A5. Ticket detail (author/SCREENS.md, STATES.md). Updated by the event
// stream (polling every 15 s while it's down); new replies and status
// changes are announced politely without moving focus.
import {
  formatDateTime,
  STATUS_LABELS,
  TicketIdParamsSchema,
  type AuthorTicketDetailDto,
} from "@bookleaf/shared";
import {
  ArrowLeftIcon,
  ConnectionIndicator,
  ErrorState,
  LoadingState,
  MessageThread,
  Notice,
  PaperclipIcon,
  Skeleton,
  StatusBadge,
  type ThreadItem,
} from "@bookleaf/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import { POLL_INTERVAL_MS, queryKeys } from "@/lib/query-client";
import { NEW_REPLY_ANNOUNCEMENT, NO_REPLY_YET, NOT_FOUND, STATUS_EXPLAINERS } from "./copy";
import { useLiveMode } from "@/providers/LiveUpdatesProvider";
import { markSeen } from "./seen";
import styles from "./tickets.module.css";

const GENERAL_ACCOUNT_LEVEL = "General / Account Level";

function BackLink() {
  return (
    <Link href="/tickets" className={styles.back}>
      <ArrowLeftIcon />
      My Tickets
    </Link>
  );
}

export function TicketDetailScreen({ ticketId }: { ticketId: string }) {
  const validId = TicketIdParamsSchema.safeParse({ ticketId }).success;
  const live = useLiveMode();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Shown once after creating the ticket; the flag is then dropped from the URL.
  const [justCreated] = useState(() => params.get("created") === "1");
  useEffect(() => {
    if (params.get("created") === "1") router.replace(pathname, { scroll: false });
  }, [params, pathname, router]);

  const ticket = useQuery({
    queryKey: queryKeys.ticket(ticketId),
    queryFn: ({ signal }) =>
      api.get<AuthorTicketDetailDto>(`/author/tickets/${ticketId}`, { signal }).then((body) => body.data),
    enabled: validId,
    refetchInterval: (query) => (query.state.error || live === "live" ? false : POLL_INTERVAL_MS),
  });

  const data = ticket.data;
  useEffect(() => {
    if (data) markSeen(data.id, data.updatedAt);
  }, [data]);

  // Announce what changed between polls.
  const [announcement, setAnnouncement] = useState("");
  const last = useRef<{ replies: number; status: string } | null>(null);
  useEffect(() => {
    if (!data) return;
    const replies = data.messages.filter((message) => message.senderRole === "admin").length;
    const before = last.current;
    if (before && replies > before.replies) setAnnouncement(NEW_REPLY_ANNOUNCEMENT);
    else if (before && data.status !== before.status) {
      setAnnouncement(`Status changed to ${STATUS_LABELS[data.status]}.`);
    }
    last.current = { replies, status: data.status };
  }, [data]);

  const notFound = !validId || isApiError(ticket.error, "NOT_FOUND");

  if (notFound) {
    return (
      <div className="bl-reading">
        <h1 className="bl-sr-only">Query not found</h1>
        <ErrorState title={NOT_FOUND} action={<BackLink />} />
      </div>
    );
  }

  if (ticket.isPending) {
    return (
      <div className="bl-reading">
        <LoadingState label="Loading your query…">
          <Skeleton width="60%" height="2rem" />
          <Skeleton width="40%" />
          <Skeleton height="8rem" />
          <Skeleton height="6rem" />
        </LoadingState>
      </div>
    );
  }

  if (ticket.isError) {
    return (
      <div className="bl-reading">
        <h1 className="bl-sr-only">Query</h1>
        <ErrorState
          title="We couldn't load this query."
          description="Please try again in a moment."
          requestId={isApiError(ticket.error) ? ticket.error.requestId : null}
          onRetry={() => void ticket.refetch()}
          action={<BackLink />}
        />
      </div>
    );
  }

  const detail = ticket.data;
  const thread: ThreadItem[] = [
    {
      id: "original",
      sender: "You",
      dateTime: detail.createdAt,
      timeLabel: formatDateTime(detail.createdAt),
      body: detail.description,
      own: true,
    },
    ...detail.messages.map((message) => ({
      id: message.id,
      sender: message.senderRole === "author" ? "You" : message.senderName,
      dateTime: message.createdAt,
      timeLabel: formatDateTime(message.createdAt),
      body: message.body,
      own: message.senderRole === "author",
    })),
  ];
  const hasReply = detail.messages.some((message) => message.senderRole === "admin");

  return (
    <div className="bl-reading">
      <BackLink />

      {justCreated ? (
        <Notice tone="success" className={styles.formNotice}>
          Thanks, we&apos;ve received your query ({detail.reference}). You&apos;ll see our reply here.
        </Notice>
      ) : null}

      <header className={styles.detailHeader}>
        <h1 className={styles.detailTitle}>{detail.subject}</h1>
        <p className={styles.reference}>
          <span className="bl-mono">{detail.reference}</span>
          <StatusBadge status={detail.status} label={STATUS_LABELS[detail.status]} />
        </p>
        <p className={styles.explainer}>{STATUS_EXPLAINERS[detail.status]}</p>
        <dl className={`bl-facts ${styles.detailFacts}`}>
          <div>
            <dt>About</dt>
            <dd>{detail.book?.title ?? GENERAL_ACCOUNT_LEVEL}</dd>
          </div>
          <div>
            <dt>Raised</dt>
            <dd>
              <time dateTime={detail.createdAt}>{formatDateTime(detail.createdAt)}</time>
            </dd>
          </div>
        </dl>
        <ConnectionIndicator mode={live} />
      </header>

      <p className="bl-sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      <section aria-labelledby="conversation-heading">
        <h2 id="conversation-heading" className={styles.sectionTitle}>
          Conversation
        </h2>
        <MessageThread items={thread} label="Messages, oldest first" />
        {detail.attachmentName ? (
          <p className={`${styles.attachment} bl-inline-icon`}>
            <PaperclipIcon />
            <span>
              Attachment noted: {detail.attachmentName}. Files aren&apos;t uploaded yet; our team may ask you
              to email it.
            </span>
          </p>
        ) : null}
        {hasReply ? null : <p className={styles.noReply}>{NO_REPLY_YET}</p>}
      </section>
    </div>
  );
}
