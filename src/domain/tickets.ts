export const TICKET_TYPES = ["dev", "task"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const TICKET_STAGES = [
  "backlog",
  "ready",
  "in-dev",
  "in-qa",
  "needs-adam",
  "closed",
] as const;
export type TicketStage = (typeof TICKET_STAGES)[number];

export const QA_RESULTS = ["pass", "fail"] as const;
export type QaResult = (typeof QA_RESULTS)[number];

const ALLOWED: Record<TicketStage, readonly TicketStage[]> = {
  backlog: ["ready"],
  ready: ["backlog", "in-dev"],
  "in-dev": ["ready", "in-qa"],
  // Leave in-qa only through submitQa (sets qa_by / qa_result / qa_date).
  "in-qa": [],
  "needs-adam": ["in-dev", "closed"],
  closed: ["backlog"],
};

export function isTicketStage(value: string): value is TicketStage {
  return (TICKET_STAGES as readonly string[]).includes(value);
}

export function isTicketType(value: string): value is TicketType {
  return (TICKET_TYPES as readonly string[]).includes(value);
}

export function isQaResult(value: string): value is QaResult {
  return (QA_RESULTS as readonly string[]).includes(value);
}

export function allowedTransitions(from: TicketStage): readonly TicketStage[] {
  return ALLOWED[from];
}

export function canTransition(from: TicketStage, to: TicketStage): boolean {
  return ALLOWED[from].includes(to);
}

/** QA is a separate pass. Fail returns the ticket to in-dev. Pass goes to needs-adam. */
export function stageAfterQa(result: QaResult): TicketStage {
  return result === "fail" ? "in-dev" : "needs-adam";
}

export function assertCanTransition(from: TicketStage, to: TicketStage): void {
  if (from === "in-qa") {
    throw new Error("Tickets in-qa can only leave through QA");
  }
  if (!canTransition(from, to)) {
    throw new Error(`Cannot move a ticket from ${from} to ${to}`);
  }
}

export function assertCanSubmitQa(stage: TicketStage): void {
  if (stage !== "in-qa") {
    throw new Error("QA can only be submitted while the ticket is in-qa");
  }
}
