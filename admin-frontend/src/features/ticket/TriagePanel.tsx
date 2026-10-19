"use client";
// Triage and assignment (admin/SCREENS.md M3 right column; STATES.md Triage;
// FLOWS.md F-M2, F-M5, F-M7). Admin values always win over AI (D-029).
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  type AdminTicketDetailDto,
  type MeDto,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type TriageAcceptedDto,
} from "@bookleaf/shared";
import { Button, ConfirmDialog, Notice, Panel, Select, SourceTag, SpinnerIcon } from "@bookleaf/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, isApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import {
  aiReasonText,
  isLowConfidence,
  needsConfirmation,
  policyFloorText,
  statusOptions,
  suggestionText,
} from "./ticket-view";
import type { TicketChanges } from "./use-ticket-update";
import styles from "./ticket.module.css";

interface Props {
  ticket: AdminTicketDetailDto;
  me: MeDto;
  pending: boolean;
  update: (changes: TicketChanges) => void;
}

function Suggestion({ field, ticket }: { field: "category" | "priority"; ticket: AdminTicketDetailDto }) {
  const text = suggestionText(field, ticket);
  if (!text) return null;
  return (
    <p className={styles.suggestion}>
      <SourceTag source={text.source} label={text.tag} />
      {text.note ? <span className="bl-muted">{text.note}</span> : null}
    </p>
  );
}

function AiState({ ticket }: { ticket: AdminTicketDetailDto }) {
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<string | null>(null);
  const retry = useMutation({
    mutationFn: () => api.post<TriageAcceptedDto>(`/admin/tickets/${ticket.id}/triage`, {}),
    onMutate: () => setProblem(null),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticket.id) }),
    onError: (error) =>
      setProblem(
        isApiError(error, "AI_UNAVAILABLE")
          ? `${aiReasonText(error.details[0]?.issue)}. Please triage it manually.`
          : isApiError(error)
            ? error.message
            : "We couldn't start AI triage. Please try again.",
      ),
  });

  if (ticket.ai.status === "pending") {
    return (
      <p className={`${styles.aiLine} bl-inline-icon`}>
        <SpinnerIcon />
        AI is triaging this ticket… You can set the category and priority yourself meanwhile.
      </p>
    );
  }
  if (ticket.ai.status === "failed" || ticket.ai.status === "manual_review_required") {
    return (
      <Notice
        tone="warning"
        title={`Needs manual triage · ${aiReasonText(ticket.ai.failureReason)}`}
        actions={
          <Button
            size="small"
            loading={retry.isPending}
            loadingLabel="Starting…"
            onClick={() => retry.mutate()}
          >
            Retry AI triage
          </Button>
        }
      >
        {problem ?? (ticket.ai.status === "failed" ? "The AI will try again automatically." : null)}
      </Notice>
    );
  }
  return ticket.ai.rationale ? (
    <p className={styles.rationale}>
      <span className={styles.rationaleLabel}>AI rationale: </span>
      {ticket.ai.rationale}
    </p>
  ) : null;
}

export function TriagePanel({ ticket, me, pending, update }: Props) {
  const [confirm, setConfirm] = useState<TicketStatus | null>(null);
  const floor = policyFloorText(ticket);

  const onStatus = (to: TicketStatus) => {
    if (to === ticket.status) return;
    if (needsConfirmation(ticket.status, to)) setConfirm(to);
    else update({ status: to });
  };

  return (
    <Panel title="Triage" headingLevel={2}>
      <div className={styles.stack}>
        <Select
          label="Status"
          value={ticket.status}
          disabled={pending}
          onChange={(event) => onStatus(event.target.value as TicketStatus)}
        >
          {statusOptions(ticket.status).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>

        <div>
          <Select
            label="Category"
            value={ticket.category ?? ""}
            disabled={pending}
            onChange={(event) => update({ category: event.target.value as TicketCategory })}
          >
            {ticket.category ? null : (
              <option value="" disabled>
                Not set yet
              </option>
            )}
            {TICKET_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
          <Suggestion field="category" ticket={ticket} />
          {ticket.categorySource === "ai" && isLowConfidence(ticket) ? (
            <Notice tone="warning" className={styles.inlineNotice}>
              Low confidence: please check the category.
            </Notice>
          ) : null}
        </div>

        <div>
          <Select
            label="Priority"
            value={ticket.priority ?? ""}
            disabled={pending}
            onChange={(event) => update({ priority: event.target.value as TicketPriority })}
          >
            {ticket.priority ? null : (
              <option value="" disabled>
                Needs triage
              </option>
            )}
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
          <Suggestion field="priority" ticket={ticket} />
          {floor ? <p className={styles.floor}>{floor}</p> : null}
        </div>

        <AiState ticket={ticket} />

        <Assignment ticket={ticket} me={me} pending={pending} update={update} />
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "closed" ? "Close this ticket?" : "Reopen this ticket?"}
        description={
          confirm === "closed"
            ? "Closed tickets can't be replied to until they're reopened."
            : `It moves from ${STATUS_LABELS[ticket.status]} back to In progress.`
        }
        confirmLabel={confirm === "closed" ? "Close ticket" : "Reopen ticket"}
        danger={confirm === "closed"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) update({ status: confirm });
          setConfirm(null);
        }}
      />
    </Panel>
  );
}

/** Self-assignment only (A-16): take an unassigned ticket or release your own. */
function Assignment({ ticket, me, pending, update }: Props) {
  const assignee = ticket.assignedAdmin;
  const mine = assignee?.userId === me.userId;
  return (
    <div className={styles.assignment}>
      <p className={styles.assignmentText}>
        {assignee ? (mine ? "Assigned to you" : `Assigned to ${assignee.displayName}`) : "Unassigned"}
      </p>
      {!assignee ? (
        <Button size="small" disabled={pending} onClick={() => update({ assignedAdminId: me.userId })}>
          Assign to me
        </Button>
      ) : mine ? (
        <Button
          size="small"
          variant="ghost"
          disabled={pending}
          onClick={() => update({ assignedAdminId: null })}
        >
          Unassign me
        </Button>
      ) : null}
    </div>
  );
}
