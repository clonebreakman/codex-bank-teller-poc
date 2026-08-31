import type { WorkflowDefinition } from "@codex-bank-teller/workflow-registry";

export type OperationClass =
  | "read_only"
  | "reversible_write"
  | "irreversible_write";

export interface PolicyInput {
  workflow?: WorkflowDefinition;
  toolName: string;
  syntheticIdentity: boolean;
  identityMatches: boolean;
  operationClass: OperationClass;
  externalDomain: boolean;
  verificationAvailable: boolean;
}

export interface PolicyDecision {
  decision: "allow" | "confirm" | "handoff" | "deny";
  riskLevel: WorkflowDefinition["riskLevel"];
  requiredConfirmation: boolean;
  allowedTools: string[];
  reasonCode: string;
}

export function decidePolicy(input: PolicyInput): PolicyDecision {
  if (!input.workflow) {
    return {
      decision: "deny",
      riskLevel: "red",
      requiredConfirmation: false,
      allowedTools: [],
      reasonCode: "WORKFLOW_NOT_REGISTERED",
    };
  }

  const base = {
    riskLevel: input.workflow.riskLevel,
    allowedTools: input.workflow.allowedTools,
  };

  if (input.externalDomain) {
    return {
      ...base,
      decision: "deny",
      requiredConfirmation: false,
      reasonCode: "EXTERNAL_DOMAIN_DENIED",
    };
  }
  if (!input.syntheticIdentity) {
    return {
      ...base,
      decision: "deny",
      requiredConfirmation: false,
      reasonCode: "SYNTHETIC_IDENTITY_REQUIRED",
    };
  }
  if (!input.workflow.allowedTools.includes(input.toolName)) {
    return {
      ...base,
      decision: "deny",
      requiredConfirmation: false,
      reasonCode: "TOOL_NOT_ALLOWED",
    };
  }
  if (!input.identityMatches) {
    return {
      ...base,
      decision: "handoff",
      requiredConfirmation: false,
      reasonCode: "IDENTITY_MISMATCH",
    };
  }
  if (input.operationClass === "irreversible_write") {
    return {
      ...base,
      decision: "deny",
      requiredConfirmation: false,
      reasonCode: "IRREVERSIBLE_WRITE_DENIED",
    };
  }
  if (!input.verificationAvailable) {
    return {
      ...base,
      decision: "handoff",
      requiredConfirmation: false,
      reasonCode: "VERIFICATION_UNAVAILABLE",
    };
  }
  if (input.operationClass === "reversible_write") {
    return {
      ...base,
      decision: "confirm",
      requiredConfirmation: true,
      reasonCode: "REVERSIBLE_WRITE_REQUIRES_CONFIRMATION",
    };
  }

  return {
    ...base,
    decision: "allow",
    requiredConfirmation: false,
    reasonCode: "READ_ONLY_LOW_RISK",
  };
}
