import { slaState } from "@bookleaf/shared";
import type { AdminQueueRow } from "../admin-repository.js";

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
