"use client";
// Reply editor with the AI draft (admin/SCREENS.md M3, STATES.md Editor,
// FLOWS.md F-M3, F-M4, F-M8; AI-5). The draft is only a starting point: the
// admin edits and sends. Without AI the editor works the same, just empty.
import {
  formatRelative,
  TICKET_LIMITS,
  type AdminTicketDetailDto,
  type AiDraftDto,
  type ThreadMessageDto,
} from "@bookleaf/shared";
import { Button, ConfirmDialog, Disclosure, Notice, SpinnerIcon, TextArea } from "@bookleaf/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import { escalationText, loadReply, saveReply, sectionsText, shouldDraftOnOpen } from "./reply-draft";
import { aiReasonText } from "./ticket-view";
import styles from "./ticket.module.css";

type StatusAfter = "in_progress" | "resolved";

export function ReplyEditor({ ticket }: { ticket: AdminTicketDetailDto }) {
  const queryClient = useQueryClient();
  const draftKey = queryKeys.draft(ticket.id);

  // null = untouched: the field shows the AI draft (if any) until the admin types.
  const [saved] = useState(() => loadReply(ticket.id));
  const [text, setText] = useState<string | null>(saved?.text ?? null);
  const [basedOn, setBasedOn] = useState<string | null>(saved?.draftId ?? null);
  const [requested, setRequested] = useState(() => shouldDraftOnOpen(ticket));
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ text: string; requestId: string | null } | null>(null);
  const [regenerateProblem, setRegenerateProblem] = useState<string | null>(null);

  const draft = useQuery({
    queryKey: draftKey,
    queryFn: ({ signal }) =>
      api.post<AiDraftDto>(`/admin/tickets/${ticket.id}/draft`, {}, { signal }).then((body) => body.data),
    enabled: requested,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const value = text ?? draft.data?.reply ?? "";
  const draftId = text === null ? (draft.data?.id ?? null) : basedOn;

  function edit(next: string) {
    const from = text === null ? (draft.data?.id ?? null) : basedOn;
    setText(next);
    setBasedOn(from);
    setSent(null);
    saveReply(ticket.id, { text: next, draftId: from });
  }

  function reset() {
    setText(null);
    setBasedOn(null);
    saveReply(ticket.id, null);
  }

  const regenerate = useMutation({
    mutationFn: () =>
      api
        .post<AiDraftDto>(`/admin/tickets/${ticket.id}/draft`, { regenerate: true })
        .then((body) => body.data),
    onMutate: () => setRegenerateProblem(null),
    onSuccess: (fresh) => {
      queryClient.setQueryData(draftKey, fresh);
      reset();
    },
    onError: (error) =>
      setRegenerateProblem(
        isApiError(error, "RATE_LIMITED")
          ? error.message
          : isApiError(error, "AI_UNAVAILABLE")
            ? `AI draft unavailable (${aiReasonText(error.details[0]?.issue).toLowerCase()}).`
            : "We couldn't regenerate the draft. Please try again.",
      ),
  });

  const send = useMutation({
    mutationFn: (statusAfter: StatusAfter) =>
      api.post<ThreadMessageDto>(`/admin/tickets/${ticket.id}/messages`, {
        body: value.trim(),
        draftId,
        statusAfter,
      }),
    onMutate: () => {
      setProblem(null);
      setSent(null);
    },
    onSuccess: () => {
      reset();
      setRequested(false); // no automatic new draft right after replying
      queryClient.removeQueries({ queryKey: draftKey });
      setSent(`Reply sent to ${ticket.author.name}.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticket.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.queueLists });
      void queryClient.invalidateQueries({ queryKey: queryKeys.summary });
    },
    onError: (error) =>
      setProblem({
        text: isApiError(error)
          ? error.message
          : "We couldn't send the reply. Your text is still here; please try again.",
        requestId: isApiError(error) ? error.requestId : null,
      }),
  });

  const busy = send.isPending;
  const empty = value.trim() === "";
  const draftLoading = requested && draft.isFetching && !draft.data;
  const draftFailed = requested && draft.isError;

  return (
    <section aria-labelledby="reply-heading" className={styles.editor}>
      <h2 id="reply-heading" className={styles.sectionTitle}>
        Reply to {ticket.author.name}
      </h2>

      {sent ? (
        <Notice tone="success" className={styles.inlineNotice}>
          {sent}
        </Notice>
      ) : null}

      {/* AI draft state */}
      {!requested ? (
        <p className={styles.draftStrip}>
          <Button size="small" onClick={() => setRequested(true)}>
            Draft a reply with AI
          </Button>
          <span className="bl-muted">A suggestion to edit; nothing is sent until you send it.</span>
        </p>
      ) : draftLoading ? (
        <p className={`${styles.draftStrip} bl-inline-icon`} role="status">
          <SpinnerIcon />
          Drafting a reply… You can start typing meanwhile.
        </p>
      ) : draftFailed ? (
        <Notice
          tone="info"
          className={styles.inlineNotice}
          actions={
            isApiError(draft.error, "AI_UNAVAILABLE") ? null : (
              <Button size="small" onClick={() => void draft.refetch()}>
                Try again
              </Button>
            )
          }
        >
          AI draft unavailable (
          {isApiError(draft.error, "AI_UNAVAILABLE")
            ? aiReasonText(draft.error.details[0]?.issue).toLowerCase()
            : "something went wrong"}
          ). Write your reply below.
        </Notice>
      ) : draft.data ? (
        <DraftDetails
          draft={draft.data}
          regenerating={regenerate.isPending}
          onRegenerate={() => (text !== null ? setConfirmRegenerate(true) : regenerate.mutate())}
        />
      ) : null}

      {regenerateProblem ? (
        <Notice tone="warning" className={styles.inlineNotice}>
          {regenerateProblem}
        </Notice>
      ) : null}

      {problem ? (
        <Notice tone="error" title="The reply wasn't sent." className={styles.inlineNotice}>
          <p className={styles.noticeText}>{problem.text}</p>
          {problem.requestId ? (
            <p className={styles.noticeText}>
              Reference: <span className="bl-mono">{problem.requestId}</span>
            </p>
          ) : null}
        </Notice>
      ) : null}

      <TextArea
        label="Reply"
        hint="The author sees this. Check AI suggestions before sending."
        value={value}
        onChange={(event) => edit(event.target.value)}
        counterMax={TICKET_LIMITS.messageBody.max}
        readOnly={busy}
        rows={12}
      />

      {draft.data && draft.data.internalChecklist.length > 0 ? (
        <Disclosure summary={`Internal checklist (${draft.data.internalChecklist.length})`}>
          <ul className={styles.list}>
            {draft.data.internalChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Disclosure>
      ) : null}

      <div className={styles.editorActions}>
        <Button
          variant="primary"
          disabled={empty}
          loading={busy && send.variables === "in_progress"}
          loadingLabel="Sending…"
          onClick={() => send.mutate("in_progress")}
        >
          Send reply
        </Button>
        <Button
          disabled={empty || busy}
          loading={busy && send.variables === "resolved"}
          loadingLabel="Sending…"
          onClick={() => send.mutate("resolved")}
        >
          Send &amp; resolve
        </Button>
        {text !== null ? (
          <Button variant="ghost" disabled={busy} onClick={reset}>
            {draft.data ? "Discard changes" : "Clear"}
          </Button>
        ) : null}
        {empty ? <p className={styles.editorHint}>Write a reply to send it.</p> : null}
      </div>

      <ConfirmDialog
        open={confirmRegenerate}
        title="Replace your edits with a new draft?"
        description="Your changes to the current text will be lost."
        confirmLabel="Replace with new draft"
        danger
        onCancel={() => setConfirmRegenerate(false)}
        onConfirm={() => {
          setConfirmRegenerate(false);
          regenerate.mutate();
        }}
      />
    </section>
  );
}

function DraftDetails({
  draft,
  regenerating,
  onRegenerate,
}: {
  draft: AiDraftDto;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  const escalation = escalationText(draft);
  return (
    <>
      <div className={styles.draftStrip}>
        <p className={styles.draftMeta}>
          <span className={styles.draftTag}>AI draft</span> · {draft.model} · uses: {sectionsText(draft)} ·{" "}
          {formatRelative(draft.createdAt)}
        </p>
        <Button
          size="small"
          variant="ghost"
          loading={regenerating}
          loadingLabel="Regenerating…"
          onClick={onRegenerate}
        >
          Regenerate
        </Button>
      </div>
      {draft.factWarnings.length > 0 ? (
        <Notice tone="warning" title="Check these before sending" className={styles.inlineNotice}>
          <ul className={styles.list}>
            {draft.factWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {draft.missingInformation.length > 0 ? (
        <Notice tone="info" title="Missing information" className={styles.inlineNotice} announce={false}>
          <ul className={styles.list}>
            {draft.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {escalation ? (
        <Notice tone="info" className={styles.inlineNotice} announce={false}>
          {escalation}
        </Notice>
      ) : null}
    </>
  );
}
