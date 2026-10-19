// Deterministic priority floors (AI_SPEC.md section 5), applied after the
// model's output is validated. They only ever RAISE priority, and the rule
// that set the final level is recorded in tickets.ai_policy_floor.
import type { TicketPriority, TriageSignal } from "@bookleaf/shared";

const RANK: Record<TicketPriority, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export const PRIORITY_FLOORS: readonly { rule: string; signal: TriageSignal; floor: TicketPriority }[] = [
  { rule: "legal_floor", signal: "legal_or_rights", floor: "critical" }, // A-09
  { rule: "isbn_error_floor", signal: "isbn_error", floor: "high" }, // KB: ISBN errors escalate
  { rule: "payment_overdue_floor", signal: "payment_overdue", floor: "high" }, // KB: overdue payments escalate
];

export function applyPriorityFloors(
  priority: TicketPriority,
  signals: readonly TriageSignal[],
): { priority: TicketPriority; floor: string | null } {
  let result = { priority, floor: null as string | null };
  for (const { rule, signal, floor } of PRIORITY_FLOORS) {
    if (signals.includes(signal) && RANK[floor] > RANK[result.priority])
      result = { priority: floor, floor: rule };
  }
  return result;
}
