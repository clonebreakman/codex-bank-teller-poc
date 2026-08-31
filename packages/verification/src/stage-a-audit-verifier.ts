import type { AuditEvent } from "@codex-bank-teller/audit-log";

interface StageAScenarioContract {
  id: string;
  workflowId: string;
  riskLevel: "green" | "yellow" | "red";
  allowedTools: readonly string[];
}

export interface StageAAuditCompletenessInput {
  scenarios: readonly StageAScenarioContract[];
  events: readonly AuditEvent[];
}

export interface StageAAuditCompletenessResult {
  verified: boolean;
  coverage: number;
  missingScenarioIds: string[];
  invalidEventIds: string[];
  verificationCode: "STAGE_A_AUDIT_COMPLETE" | "STAGE_A_AUDIT_INCOMPLETE";
}

export function verifyStageAAuditCompleteness(
  input: StageAAuditCompletenessInput,
): StageAAuditCompletenessResult {
  const missingScenarioIds: string[] = [];
  const invalidEventIds: string[] = [];

  for (const scenario of input.scenarios) {
    const event = input.events.find((candidate) => candidate.workflowId === scenario.workflowId);
    if (!event) {
      missingScenarioIds.push(scenario.id);
      continue;
    }
    if (!isCompleteEvent(event, scenario)) {
      invalidEventIds.push(event.eventId);
    }
  }

  const covered = input.scenarios.length - missingScenarioIds.length;
  const coverage = input.scenarios.length === 0 ? 0 : covered / input.scenarios.length;
  const verified = missingScenarioIds.length === 0 && invalidEventIds.length === 0;
  return {
    verified,
    coverage,
    missingScenarioIds,
    invalidEventIds,
    verificationCode: verified ? "STAGE_A_AUDIT_COMPLETE" : "STAGE_A_AUDIT_INCOMPLETE",
  };
}

function isCompleteEvent(
  event: AuditEvent,
  scenario: StageAScenarioContract,
): boolean {
  if (
    event.eventId.length === 0 ||
    event.runId.length === 0 ||
    event.actorType.length === 0 ||
    Number.isNaN(Date.parse(event.timestamp)) ||
    !/^[a-f0-9]{64}$/.test(event.inputHash) ||
    event.synthetic !== true ||
    event.workflowId !== scenario.workflowId ||
    !Object.prototype.hasOwnProperty.call(event, "redactedOutput")
  ) {
    return false;
  }

  const toolIsAllowed = event.toolName === undefined || scenario.allowedTools.includes(event.toolName);
  if (!toolIsAllowed) return false;

  if (scenario.riskLevel === "green") {
    return event.policyDecision === "allow" && event.result === "success";
  }
  if (scenario.riskLevel === "yellow") {
    return event.policyDecision === "confirm" && event.result === "confirmation_required";
  }
  return (
    event.policyDecision === "deny" &&
    event.result === "security_event" &&
    event.terminationReason === "PROMPT_INJECTION_DETECTED"
  );
}
