import { describe, expect, it } from "vitest";
import { accountBalanceReadWorkflow } from "@codex-bank-teller/workflow-registry";
import {
  createDefaultToolRegistry,
  executeTool,
} from "@codex-bank-teller/tool-gateway";

describe("tool gateway security boundary", () => {
  it("rejects a tool outside the registered workflow", async () => {
    const result = await executeTool(createDefaultToolRegistry(), {
      workflow: accountBalanceReadWorkflow,
      toolName: "admin.transfer.execute",
      input: {},
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: false,
      verificationAvailable: true,
      requestId: "REQ-SEC-1",
      toolCallId: "CALL-SEC-1",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_NOT_REGISTERED",
      decision: "deny",
    });
  });

  it("rejects external-domain execution even when the workflow is read-only", async () => {
    const result = await executeTool(createDefaultToolRegistry(), {
      workflow: accountBalanceReadWorkflow,
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001" },
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: true,
      verificationAvailable: true,
      requestId: "REQ-SEC-2",
      toolCallId: "CALL-SEC-2",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "POLICY_DENIED",
      reasonCode: "EXTERNAL_DOMAIN_DENIED",
    });
  });
});
