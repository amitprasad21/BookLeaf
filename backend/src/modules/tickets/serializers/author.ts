// Author-facing ticket DTOs (openapi.yaml AuthorTicketSummary / AuthorTicketDetail).
// An explicit allowlist: AI suggestions, category, priority, assignee, notes,
// drafts and version can't leak here because they're never read or copied (C-08).
import type { AuthorTicketDetailDto, AuthorTicketSummaryDto } from "@bookleaf/shared";
import type { AuthorTicketRow, ThreadMessageRow } from "../repository.js";

/** Admin replies are signed as the team, not by individual staff (assumption A-07). */
export const SUPPORT_SENDER_NAME = "BookLeaf Support";

export function toAuthorTicketSummary(row: AuthorTicketRow): AuthorTicketSummaryDto {
  return {
    id: row.id,
    reference: row.reference,
    subject: row.subject,
    status: row.status,
    book: row.book ? { bookId: row.book.book_id, title: row.book.title } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasAdminReply: row.first_response_at !== null,
  };
}

export function toAuthorTicketDetail(
  row: AuthorTicketRow,
  messages: ThreadMessageRow[],
  authorName: string,
): AuthorTicketDetailDto {
  return {
    ...toAuthorTicketSummary(row),
    description: row.description ?? "",
    attachmentName: row.attachment_name ?? null,
    messages: messages.map((message) => ({
      id: message.id,
      senderRole: message.sender_role,
      senderName: message.sender_role === "admin" ? SUPPORT_SENDER_NAME : authorName,
      body: message.body,
      createdAt: message.created_at,
    })),
  };
}
