import type { AuditEvent } from "@codex-bank-teller/audit-log";

export interface ReplayResult {
  runId: string;
  steps: Array<{
    eventId: string;
    workflowId: string;
    toolName?: string;
    policyDecision: string;
    result: string;
  }>;
}

export function replayAuditEvents(
  events: AuditEvent[],
  _executeTool?: () => unknown,
): ReplayResult {
  void _executeTool;
  if (events.length === 0) {
    throw new Error("AUDIT_EVENTS_EMPTY");
  }
  const runIds = new Set(events.map((event) => event.runId));
  if (runIds.size !== 1) {
    throw new Error("AUDIT_RUN_MISMATCH");
  }
  return {
    runId: events[0].runId,
    steps: events.map((event) => ({
      eventId: event.eventId,
      workflowId: event.workflowId,
      toolName: event.toolName,
      policyDecision: event.policyDecision,
      result: event.result,
    })),
  };
}
