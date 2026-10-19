"use client";
// Internal notes (admin/FLOWS.md F-M6): team-only, never shown to authors.
import {
  formatDateTime,
  TICKET_LIMITS,
  type AdminTicketDetailDto,
  type InternalNoteDto,
} from "@bookleaf/shared";
import { Button, Notice, Panel, TextArea } from "@bookleaf/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api, isApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import styles from "./ticket.module.css";

export function NotesPanel({ ticket }: { ticket: AdminTicketDetailDto }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (text: string) =>
      api.post<InternalNoteDto>(`/admin/tickets/${ticket.id}/notes`, { body: text }),
    onMutate: () => setError(null),
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticket.id) });
    },
    onError: (failure) =>
      setError(isApiError(failure) ? failure.message : "We couldn't add the note. Please try again."),
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setError("Write a note first.");
      return;
    }
    add.mutate(text);
  };

  return (
    <Panel title="Internal notes" headingLevel={2}>
      {ticket.notes.length === 0 ? (
        <p className="bl-muted">No internal notes yet.</p>
      ) : (
        <ol className={styles.notes}>
          {ticket.notes.map((note) => (
            <li key={note.id} className={styles.note}>
              <p className={styles.noteMeta}>
                <span className={styles.noteAuthor}>{note.author.displayName}</span>
                <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
              </p>
              <p className={styles.noteBody}>{note.body}</p>
            </li>
          ))}
        </ol>
      )}

      <form className={`bl-form ${styles.noteForm}`} onSubmit={onSubmit} noValidate>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <TextArea
          label="Add an internal note"
          hint="Visible to the BookLeaf team only"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          counterMax={TICKET_LIMITS.messageBody.max}
          readOnly={add.isPending}
          rows={3}
        />
        <div>
          <Button type="submit" loading={add.isPending} loadingLabel="Adding…">
            Add note
          </Button>
        </div>
      </form>
    </Panel>
  );
}
