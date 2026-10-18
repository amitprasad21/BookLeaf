import { STATUS_LABELS, canTransition, type UpdateTicketRequest } from "@bookleaf/shared";
import { InvalidAssignmentError, InvalidTransitionError } from "../../lib/errors.js";
import type { AdminTicketRow, TicketChanges } from "./admin-repository.js";

/** An audit event to append after the update commits (ticket id and actor are added by the caller). */
export interface PlannedAuditEvent {
  action: string;
  metadata: Record<string, unknown>;
}

export interface TicketUpdatePlan {
  changes: TicketChanges;
  audit: PlannedAuditEvent[];
}

/**
 * Turns a PATCH into column changes and audit events, enforcing the rules in
 * .back/TICKET_LIFECYCLE.md. Pure: the caller has already checked `version`.
 *
 * - Values equal to the current ones are not changes (no write, no audit), so
 *   a repeated request is harmless.
 * - Status follows the state machine (422 otherwise); resolving or closing
 *   stamps the time, and reopening clears both stamps.
 * - Category/priority become admin-set, even when the value matches the AI's
 *   suggestion (that confirms it). The AI's own suggestion columns are kept.
 * - Assignment is self-service only (A-16): take an unassigned ticket, or
 *   release your own. Anything else is 422 INVALID_ASSIGNMENT.
 */
export function planTicketUpdate(
  current: AdminTicketRow,
  request: UpdateTicketRequest,
  callerId: string,
  now: Date,
): TicketUpdatePlan {
  const changes: TicketChanges = {};
  const audit: PlannedAuditEvent[] = [];

  if (request.status !== undefined && request.status !== current.status) {
    const [from, to] = [current.status, request.status];
    if (!canTransition(from, to)) {
      throw new InvalidTransitionError(
        `A ticket can't move from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to]}.`,
      );
    }
    changes.status = to;
    if (to === "resolved") changes.resolved_at = now.toISOString();
    if (to === "closed") changes.closed_at = now.toISOString();
    if (to === "in_progress" && (from === "resolved" || from === "closed")) {
      changes.resolved_at = null;
      changes.closed_at = null;
    }
    audit.push({ action: "ticket.status_changed", metadata: { from, to } });
  }

  for (const field of ["category", "priority"] as const) {
    const value = request[field];
    const sourceField = `${field}_source` as const;
    if (value === undefined) continue;
    if (value === current[field] && current[sourceField] === "admin") continue;
    if (field === "category") changes.category = request.category;
    else changes.priority = request.priority;
    changes[sourceField] = "admin";
    audit.push({
      action: `ticket.${field}_overridden`,
      metadata: { from: current[field], fromSource: current[sourceField], to: value },
    });
  }

  if (
    request.assignedAdminId !== undefined &&
    request.assignedAdminId !== (current.assigned_admin?.id ?? null)
  ) {
    const assignee = current.assigned_admin;
    if (request.assignedAdminId === null) {
      // Only reached when someone is assigned: it must be the caller.
      if (assignee?.id !== callerId) {
        throw new InvalidAssignmentError(
          `Only ${assignee?.display_name ?? "the assignee"} can unassign this ticket.`,
        );
      }
      changes.assigned_admin_id = null;
      audit.push({ action: "ticket.unassigned", metadata: { adminId: callerId } });
    } else if (request.assignedAdminId !== callerId) {
      throw new InvalidAssignmentError();
    } else if (assignee) {
      throw new InvalidAssignmentError(
        `This ticket is assigned to ${assignee.display_name}. They need to unassign it first.`,
      );
    } else {
      changes.assigned_admin_id = callerId;
      audit.push({ action: "ticket.assigned", metadata: { adminId: callerId } });
    }
  }

  return { changes, audit };
}
