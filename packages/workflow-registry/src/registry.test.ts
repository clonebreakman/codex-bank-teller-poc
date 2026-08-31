import { describe, expect, it } from "vitest";
import {
  accountBalanceReadWorkflow,
  accountTransactionsReadWorkflow,
  createDefaultWorkflowRegistry,
  receiptReadWorkflow,
  registerWorkflow,
  createWorkflowRegistry,
} from "./registry.js";

describe("workflow registry", () => {
  it("registers and retrieves an approved read-only workflow", () => {
    const registry = createWorkflowRegistry();
    registerWorkflow(registry, accountBalanceReadWorkflow);

    expect(registry.get("account.balance.read")).toMatchObject({
      workflowId: "account.balance.read",
      riskLevel: "green",
      allowedTools: ["account.balance.read"],
      successVerifier: "account-balance-verifier",
    });
  });

  it("rejects duplicate IDs, empty tools, and missing verification", () => {
    const registry = createWorkflowRegistry();
    registerWorkflow(registry, accountBalanceReadWorkflow);

    expect(() =>
      registerWorkflow(registry, accountBalanceReadWorkflow),
    ).toThrowError("WORKFLOW_DUPLICATE");

    expect(() =>
      registerWorkflow(registry, {
        ...accountBalanceReadWorkflow,
        workflowId: "invalid.empty-tools",
        allowedTools: [],
      }),
    ).toThrowError("WORKFLOW_TOOLS_EMPTY");

    expect(() =>
      registerWorkflow(registry, {
        ...accountBalanceReadWorkflow,
        workflowId: "invalid.no-verifier",
        successVerifier: "",
      }),
    ).toThrowError("WORKFLOW_VERIFIER_MISSING");
  });

  it("lists only explicitly registered workflows", () => {
    const registry = createWorkflowRegistry();
    registerWorkflow(registry, accountBalanceReadWorkflow);

    expect(registry.list().map((workflow) => workflow.workflowId)).toEqual([
      "account.balance.read",
    ]);
    expect(registry.get("unknown.workflow")).toBeUndefined();
  });

  it("provides exactly the approved initial read-only workflow set", () => {
    const registry = createDefaultWorkflowRegistry();

    expect(registry.list().map((workflow) => workflow.workflowId)).toEqual([
      "account.balance.read",
      "account.transactions.read",
      "receipt.read",
    ]);
    expect(accountTransactionsReadWorkflow.allowedTools).toEqual([
      "account.transactions.read",
    ]);
    expect(receiptReadWorkflow.allowedTools).toEqual(["receipt.read"]);
  });
});
