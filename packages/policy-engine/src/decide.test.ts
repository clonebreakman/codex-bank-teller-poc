import { describe, expect, it } from "vitest";
import { accountBalanceReadWorkflow } from "@codex-bank-teller/workflow-registry";
import { decidePolicy } from "./decide.js";

describe("policy decisions", () => {
  it("allows a synthetic read-only workflow with a whitelisted tool", () => {
    expect(
      decidePolicy({
        workflow: accountBalanceReadWorkflow,
        toolName: "account.balance.read",
        syntheticIdentity: true,
        identityMatches: true,
        operationClass: "read_only",
        externalDomain: false,
        verificationAvailable: true,
      }),
    ).toEqual({
      decision: "allow",
      riskLevel: "green",
      requiredConfirmation: false,
      allowedTools: ["account.balance.read"],
      reasonCode: "READ_ONLY_LOW_RISK",
    });
  });

  it("requires confirmation for reversible writes", () => {
    const result = decidePolicy({
      workflow: {
        ...accountBalanceReadWorkflow,
        workflowId: "appointment.draft",
        riskLevel: "yellow",
        allowedTools: ["appointment.draft.create"],
      },
      toolName: "appointment.draft.create",
      syntheticIdentity: true,
      identityMatches: true,
      operationClass: "reversible_write",
      externalDomain: false,
      verificationAvailable: true,
    });

    expect(result).toMatchObject({
      decision: "confirm",
      requiredConfirmation: true,
      reasonCode: "REVERSIBLE_WRITE_REQUIRES_CONFIRMATION",
    });
  });

  it("hands off identity mismatch or unavailable verification", () => {
    expect(
      decidePolicy({
        workflow: accountBalanceReadWorkflow,
        toolName: "account.balance.read",
        syntheticIdentity: true,
        identityMatches: false,
        operationClass: "read_only",
        externalDomain: false,
        verificationAvailable: true,
      }),
    ).toMatchObject({ decision: "handoff", reasonCode: "IDENTITY_MISMATCH" });

    expect(
      decidePolicy({
        workflow: accountBalanceReadWorkflow,
        toolName: "account.balance.read",
        syntheticIdentity: true,
        identityMatches: true,
        operationClass: "read_only",
        externalDomain: false,
        verificationAvailable: false,
      }),
    ).toMatchObject({
      decision: "handoff",
      reasonCode: "VERIFICATION_UNAVAILABLE",
    });
  });

  it("denies unknown tools, external domains, and irreversible writes", () => {
    expect(
      decidePolicy({
        workflow: accountBalanceReadWorkflow,
        toolName: "admin.transfer.execute",
        syntheticIdentity: true,
        identityMatches: true,
        operationClass: "read_only",
        externalDomain: false,
        verificationAvailable: true,
      }),
    ).toMatchObject({ decision: "deny", reasonCode: "TOOL_NOT_ALLOWED" });

    expect(
      decidePolicy({
        workflow: accountBalanceReadWorkflow,
        toolName: "account.balance.read",
        syntheticIdentity: true,
        identityMatches: true,
        operationClass: "read_only",
        externalDomain: true,
        verificationAvailable: true,
      }),
    ).toMatchObject({ decision: "deny", reasonCode: "EXTERNAL_DOMAIN_DENIED" });

    expect(
      decidePolicy({
        workflow: accountBalanceReadWorkflow,
        toolName: "account.balance.read",
        syntheticIdentity: true,
        identityMatches: true,
        operationClass: "irreversible_write",
        externalDomain: false,
        verificationAvailable: true,
      }),
    ).toMatchObject({
      decision: "deny",
      reasonCode: "IRREVERSIBLE_WRITE_DENIED",
    });

    expect(
      decidePolicy({
        workflow: undefined,
        toolName: "account.balance.read",
        syntheticIdentity: true,
        identityMatches: true,
        operationClass: "read_only",
        externalDomain: false,
        verificationAvailable: true,
      }),
    ).toMatchObject({ decision: "deny", reasonCode: "WORKFLOW_NOT_REGISTERED" });

    expect(
      decidePolicy({
        workflow: accountBalanceReadWorkflow,
        toolName: "account.balance.read",
        syntheticIdentity: false,
        identityMatches: true,
        operationClass: "read_only",
        externalDomain: false,
        verificationAvailable: true,
      }),
    ).toMatchObject({
      decision: "deny",
      reasonCode: "SYNTHETIC_IDENTITY_REQUIRED",
    });
  });
});
