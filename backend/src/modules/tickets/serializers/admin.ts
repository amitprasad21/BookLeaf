import { slaState } from "@bookleaf/shared";
import { toBookDto } from "../../books/serializers.js";
import type { AdminQueueRow, AdminTicketDetailRows } from "../admin-repository.js";

/** AdminQueueItem (openapi.yaml). `slaState` is computed at `now`, never stored. */
export function toAdminQueueItem(row: AdminQueueRow, now: Date) {
  return {
    id: row.id,
    reference: row.reference,
    subject: row.subject,
    author: { authorId: row.author.author_id, name: row.author.name },
    book: row.book ? { bookId: row.book.book_id, title: row.book.title } : null,
    status: row.status,
    category: row.category,
    categorySource: row.category_source,
    priority: row.priority,
    prioritySource: row.priority_source,
    aiStatus: row.ai_status,
    assignedAdmin: row.assigned_admin
      ? { userId: row.assigned_admin.id, displayName: row.assigned_admin.display_name }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    firstResponseAt: row.first_response_at,
    slaState: slaState(
      {
        status: row.status,
        priority: row.priority,
        createdAt: new Date(row.created_at),
        firstResponseAt: row.first_response_at ? new Date(row.first_response_at) : null,
      },
      now,
    ),
    version: row.version,
  };
}

const adminRef = (profile: { id: string; display_name: string } | null) =>
  profile ? { userId: profile.id, displayName: profile.display_name } : null;

/**
 * AdminTicketDetail (openapi.yaml): the queue item plus the description, the
 * author's profile and books (with royalty figures), the thread with real
 * sender names, internal notes, the AI suggestion and the audit timeline.
 * Author email and phone are never included.
 */
export function toAdminTicketDetail(detail: AdminTicketDetailRows, now: Date) {
  const { ticket } = detail;
  return {
    ...toAdminQueueItem(ticket, now),
    description: ticket.description,
    attachmentName: ticket.attachment_name,
    resolvedAt: ticket.resolved_at,
    closedAt: ticket.closed_at,
    authorContext: {
      author: {
        authorId: ticket.author.author_id,
        name: ticket.author.name,
        city: ticket.author.city,
        joinedDate: ticket.author.joined_date,
      },
      books: detail.books.map(toBookDto),
    },
    messages: detail.messages.map((message) => ({
      id: message.id,
      senderRole: message.sender_role,
      senderName:
        message.sender?.display_name ??
        (message.sender_role === "admin" ? "BookLeaf Support" : ticket.author.name),
      body: message.body,
      createdAt: message.created_at,
    })),
    notes: detail.notes.map((note) => ({
      id: note.id,
      author: adminRef(note.admin),
      body: note.body,
      createdAt: note.created_at,
    })),
    ai: {
      status: ticket.ai_status,
      suggestedCategory: ticket.ai_category,
      suggestedPriority: ticket.ai_priority,
      confidence: ticket.ai_confidence === null ? null : Number(ticket.ai_confidence),
      signals: ticket.ai_signals,
      rationale: ticket.ai_rationale,
      policyFloorApplied: ticket.ai_policy_floor,
      processedAt: ticket.ai_processed_at,
      failureReason: ticket.ai_failure_reason,
    },
    timeline: detail.timeline.map((event) => ({
      id: event.id,
      action: event.action,
      actor: adminRef(event.actor),
      metadata: event.metadata,
      createdAt: event.created_at,
    })),
  };
}
