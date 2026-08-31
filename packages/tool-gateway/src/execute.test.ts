import { describe, expect, it } from "vitest";
import { accountBalanceReadWorkflow } from "@codex-bank-teller/workflow-registry";
import { MockBankService } from "@codex-bank-teller/mock-bank/service";
import { createDefaultToolRegistry, executeTool } from "./index.js";

describe("tool gateway execution", () => {
  it("executes a whitelisted balance tool and returns a stable envelope", async () => {
    const result = await executeTool(createDefaultToolRegistry(), {
      workflow: accountBalanceReadWorkflow,
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001", customerId: "CUST-1001" },
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: false,
      verificationAvailable: true,
      requestId: "REQ-1001",
      toolCallId: "CALL-1001",
    });

    expect(result).toMatchObject({
      ok: true,
      tool_call_id: "CALL-1001",
      request_id: "REQ-1001",
      decision: "allow",
    });
    expect(result.data).toMatchObject({ balanceMinor: 125000 });
  });

  it("does not execute an unknown tool or a policy-denied tool", async () => {
    const registry = createDefaultToolRegistry();
    const unknown = await executeTool(registry, {
      workflow: accountBalanceReadWorkflow,
      toolName: "admin.transfer.execute",
      input: {},
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: false,
      verificationAvailable: true,
      requestId: "REQ-1002",
      toolCallId: "CALL-1002",
    });

    expect(unknown).toMatchObject({
      ok: false,
      code: "TOOL_NOT_REGISTERED",
      decision: "deny",
    });

    const denied = await executeTool(registry, {
      workflow: accountBalanceReadWorkflow,
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001" },
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: true,
      verificationAvailable: true,
      requestId: "REQ-1003",
      toolCallId: "CALL-1003",
    });

    expect(denied).toMatchObject({
      ok: false,
      code: "POLICY_DENIED",
      reasonCode: "EXTERNAL_DOMAIN_DENIED",
    });
  });

  it("returns the first result for a repeated idempotency key", async () => {
    let executions = 0;
    const registry = createDefaultToolRegistry(new MockBankService());
    const original = registry.get("account.balance.read")!;
    registry.replace({
      ...original,
      execute: async (input) => {
        executions += 1;
        return original.execute(input);
      },
    });

    const request = {
      workflow: accountBalanceReadWorkflow,
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001" },
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: false,
      verificationAvailable: true,
      requestId: "REQ-1004",
      toolCallId: "CALL-1004",
      idempotencyKey: "idem-1004",
    };
    const first = await executeTool(registry, request);
    const second = await executeTool(registry, {
      ...request,
      requestId: "REQ-1005",
      toolCallId: "CALL-1005",
    });

    expect(executions).toBe(1);
    expect(second).toEqual(first);
  });

  it("re-checks policy before using an idempotent result", async () => {
    const registry = createDefaultToolRegistry();
    const request = {
      workflow: accountBalanceReadWorkflow,
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001" },
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: false,
      verificationAvailable: true,
      requestId: "REQ-1006",
      toolCallId: "CALL-1006",
      idempotencyKey: "idem-1006",
    };

    await executeTool(registry, request);
    const denied = await executeTool(registry, {
      ...request,
      externalDomain: true,
    });

    expect(denied).toMatchObject({
      ok: false,
      code: "POLICY_DENIED",
      reasonCode: "EXTERNAL_DOMAIN_DENIED",
    });
  });

  it("returns structured validation and timeout failures", async () => {
    const registry = createDefaultToolRegistry();
    const invalid = await executeTool(registry, {
      workflow: accountBalanceReadWorkflow,
      toolName: "account.balance.read",
      input: { accountId: "" },
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: false,
      verificationAvailable: true,
      requestId: "REQ-1007",
      toolCallId: "CALL-1007",
    });
    expect(invalid).toMatchObject({ ok: false, code: "INPUT_INVALID" });

    const slow = createDefaultToolRegistry();
    const tool = slow.get("account.balance.read")!;
    slow.replace({
      ...tool,
      execute: async () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)),
    });
    const timeout = await executeTool(slow, {
      workflow: accountBalanceReadWorkflow,
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001" },
      syntheticIdentity: true,
      identityMatches: true,
      externalDomain: false,
      verificationAvailable: true,
      requestId: "REQ-1008",
      toolCallId: "CALL-1008",
      timeoutMs: 1,
    });
    expect(timeout).toMatchObject({ ok: false, code: "EXECUTION_TIMEOUT" });
  });
});
