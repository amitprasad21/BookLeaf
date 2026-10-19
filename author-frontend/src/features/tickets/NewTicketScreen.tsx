"use client";
// A3. Raise a query (author/SCREENS.md, STATES.md, FLOWS.md F-A3). The ticket
// is saved whatever happens to AI triage, and the author never sees AI state.
import { TICKET_LIMITS, type AuthorBooksDto, type AuthorTicketDetailDto } from "@bookleaf/shared";
import { Button, FileInput, Notice, PageHeader, Select, TextArea, TextField } from "@bookleaf/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api, isApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-client";
import {
  attachmentProblem,
  clearDraft,
  FIELD_ORDER,
  GENERAL,
  loadDraft,
  retryAfterText,
  saveDraft,
  serverFieldErrors,
  validateQuery,
  type FieldErrors,
  type QueryDraft,
  type QueryField,
} from "./query-form";
import styles from "./tickets.module.css";

const FIELD_IDS: Record<QueryField, string> = {
  about: "query-about",
  subject: "query-subject",
  description: "query-description",
  attachment: "query-attachment",
};

const FIELD_LABELS: Record<QueryField, string> = {
  about: "About",
  subject: "Subject",
  description: "Description",
  attachment: "Attachment",
};

const ATTACHMENT_HINT =
  "Upload isn't enabled yet. We'll record the filename; our team may ask you to email the file.";

type Problem = { kind: "rate_limited"; message: string } | { kind: "failed"; requestId: string | null };

export function NewTicketScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const bookParam = params.get("bookId");

  const books = useQuery({
    queryKey: queryKeys.books,
    queryFn: ({ signal }) => api.get<AuthorBooksDto>("/author/books", { signal }).then((body) => body.data),
  });

  // Unsent text comes back after an error, a reload or an expired session.
  const [draft, setDraft] = useState<QueryDraft>(() => {
    const saved = loadDraft();
    return {
      about: bookParam ?? saved?.about ?? "",
      subject: saved?.subject ?? "",
      description: saved?.description ?? "",
    };
  });
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showSummary, setShowSummary] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveDraft(draft), [draft]);

  // A book id that isn't one of the author's books (or a list that failed to
  // load) falls back to "choose"; General is always available.
  const bookList = books.data?.books;
  const about =
    draft.about === GENERAL ||
    (books.isPending && draft.about !== "") ||
    (bookList ?? []).some((book) => book.bookId === draft.about)
      ? draft.about
      : "";

  const focusField = (field: QueryField) => document.getElementById(FIELD_IDS[field])?.focus();

  const create = useMutation({
    mutationFn: (request: unknown) => api.post<AuthorTicketDetailDto>("/author/tickets", request),
    onSuccess: ({ data: ticket }) => {
      clearDraft();
      queryClient.setQueryData(queryKeys.ticket(ticket.id), ticket);
      void queryClient.invalidateQueries({ queryKey: queryKeys.ticketLists });
      router.push(`/tickets/${ticket.id}?created=1`);
    },
    onError: (error: Error) => {
      if (isApiError(error, "VALIDATION_FAILED")) {
        const fieldErrors = serverFieldErrors(error.details);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          setShowSummary(true);
          const first = FIELD_ORDER.find((field) => fieldErrors[field]);
          if (first) focusField(first);
          return;
        }
      }
      setProblem(
        isApiError(error, "RATE_LIMITED")
          ? {
              kind: "rate_limited",
              message: `You've sent several queries recently. ${retryAfterText(error.retryAfterSeconds)}`,
            }
          : { kind: "failed", requestId: isApiError(error) ? error.requestId : null },
      );
    },
  });
  const submitting = create.isPending;

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  function update<K extends keyof QueryDraft>(key: K, value: QueryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setAttachmentName(null);
      setErrors((current) => ({ ...current, attachment: undefined }));
      return;
    }
    const problemText = attachmentProblem(file);
    setAttachmentName(problemText ? null : file.name);
    setErrors((current) => ({ ...current, attachment: problemText ?? undefined }));
    if (problemText) event.target.value = "";
  }

  function removeFile() {
    if (fileInput.current) fileInput.current.value = "";
    setAttachmentName(null);
    setErrors((current) => ({ ...current, attachment: undefined }));
    fileInput.current?.focus();
  }

  function submit() {
    if (submitting) return;
    setProblem(null);
    const result = validateQuery({ ...draft, about }, attachmentName);
    const fieldErrors: FieldErrors = {
      ...(result.ok ? {} : result.errors),
      ...(errors.attachment ? { attachment: errors.attachment } : {}),
    };
    if (!result.ok || fieldErrors.attachment) {
      setErrors(fieldErrors);
      setShowSummary(true);
      const first = FIELD_ORDER.find((field) => fieldErrors[field]);
      if (first) focusField(first);
      return;
    }
    setErrors({});
    setShowSummary(false);
    create.mutate(result.request);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  const invalidFields = FIELD_ORDER.filter((field) => errors[field]);

  return (
    <div className="bl-reading">
      <PageHeader
        title="Raise a query"
        description="Tell us what you need help with. We'll reply here, usually within one working day."
      />

      {problem ? (
        <div ref={problemRef} tabIndex={-1} className={styles.formNotice}>
          {problem.kind === "rate_limited" ? (
            <Notice tone="warning" title="Please wait before sending another query">
              {problem.message}
            </Notice>
          ) : (
            <Notice
              tone="error"
              title="We couldn't send your query."
              actions={
                <Button size="small" onClick={submit} loading={submitting} loadingLabel="Sending…">
                  Try again
                </Button>
              }
            >
              <p className={styles.noticeText}>Your text is still here; please try again.</p>
              {problem.requestId ? (
                <p className={styles.noticeText}>
                  Reference: <span className="bl-mono">{problem.requestId}</span>
                </p>
              ) : null}
            </Notice>
          )}
        </div>
      ) : null}

      {showSummary && invalidFields.length > 0 ? (
        <Notice tone="error" title="Please fix the following:" className={styles.formNotice}>
          <ul className={styles.summaryList}>
            {invalidFields.map((field) => (
              <li key={field}>
                <a className="bl-link" href={`#${FIELD_IDS[field]}`}>
                  {FIELD_LABELS[field]}: {errors[field]}
                </a>
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {books.isError ? (
        <Notice tone="warning" className={styles.formNotice}>
          We couldn&apos;t load your book list; you can still send a general query.
        </Notice>
      ) : null}

      <form className={`bl-form ${styles.form}`} noValidate onSubmit={onSubmit} aria-busy={submitting}>
        <Select
          id={FIELD_IDS.about}
          label="About"
          value={about}
          onChange={(event) => update("about", event.target.value)}
          error={errors.about}
          disabled={submitting}
          required
        >
          <option value="" disabled>
            {books.isPending ? "Loading your books…" : "Choose a book or General / Account Level"}
          </option>
          {(bookList ?? []).map((book) => (
            <option key={book.bookId} value={book.bookId}>
              {book.title} · {book.status}
            </option>
          ))}
          <option value={GENERAL}>General / Account Level</option>
        </Select>

        <TextField
          id={FIELD_IDS.subject}
          label="Subject"
          hint="A short summary, e.g. 'Royalty for Q3 not received'"
          value={draft.subject}
          onChange={(event) => update("subject", event.target.value)}
          maxLength={TICKET_LIMITS.subject.max}
          error={errors.subject}
          readOnly={submitting}
          autoComplete="off"
          required
        />

        <TextArea
          id={FIELD_IDS.description}
          label="Description"
          hint="Include dates, platforms and amounts if relevant."
          value={draft.description}
          onChange={(event) => update("description", event.target.value)}
          counterMax={TICKET_LIMITS.description.max}
          error={errors.description}
          readOnly={submitting}
          rows={8}
          required
        />

        <div>
          <FileInput
            ref={fileInput}
            id={FIELD_IDS.attachment}
            label="Attachment"
            optional
            hint={ATTACHMENT_HINT}
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            onChange={onFileChange}
            selectedName={attachmentName}
            error={errors.attachment}
            disabled={submitting}
          />
          {attachmentName ? (
            <Button variant="ghost" size="small" onClick={removeFile} disabled={submitting}>
              Remove file
            </Button>
          ) : null}
        </div>

        <div className={styles.formActions}>
          <Button type="submit" variant="primary" loading={submitting} loadingLabel="Sending…">
            Send to BookLeaf
          </Button>
        </div>
      </form>
    </div>
  );
}
