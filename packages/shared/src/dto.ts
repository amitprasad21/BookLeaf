// Response DTOs (openapi.yaml components/schemas). The backend serializers
// return these types, so a field the contract doesn't list fails to compile
// there before a frontend can depend on it.
import type { Role, TicketStatus } from "./enums.js";

/** Success envelope: `{ data, meta? }`. */
export interface ApiEnvelope<T, M = undefined> {
  data: T;
  meta?: M;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface AuthorProfileDto {
  authorId: string;
  name: string;
  city: string | null;
  joinedDate: string;
}

/** GET /me */
export interface MeDto {
  userId: string;
  role: Role;
  displayName: string;
  author: AuthorProfileDto | null;
}

/** Nullable fields are null for books still in production; never coerce them to zero. */
export interface BookDto {
  bookId: string;
  title: string;
  isbn: string;
  genre: string;
  publicationDate: string | null;
  status: string;
  isPublished: boolean;
  mrp: number | null;
  authorRoyaltyPerCopy: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: number;
  royaltyPaid: number;
  royaltyPending: number;
  lastRoyaltyPayoutDate: string | null;
  printPartner: string | null;
  availableOn: string[];
}

export interface RoyaltySummaryDto {
  totalEarned: number;
  totalPaid: number;
  totalPending: number;
  payoutThreshold: number;
  /** 0 < totalPending < payoutThreshold: rolls over to the next quarter. */
  pendingBelowThreshold: boolean;
  nextPayoutDueBy: string;
}

/** GET /author/books */
export interface AuthorBooksDto {
  books: BookDto[];
  summary: RoyaltySummaryDto;
}

export interface BookRefDto {
  bookId: string;
  title: string;
}

export interface ThreadMessageDto {
  id: string;
  senderRole: Role;
  senderName: string;
  body: string;
  createdAt: string;
}

export interface AuthorTicketSummaryDto {
  id: string;
  reference: string;
  subject: string;
  status: TicketStatus;
  book: BookRefDto | null;
  createdAt: string;
  updatedAt: string;
  hasAdminReply: boolean;
}

/** Author-safe view: no AI, priority, category, assignee or note fields. */
export interface AuthorTicketDetailDto extends AuthorTicketSummaryDto {
  description: string;
  attachmentName: string | null;
  messages: ThreadMessageDto[];
}
