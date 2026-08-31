import { describe, expect, it } from "vitest";
import {
  createRun,
  transitionRun,
  type RunStatus,
} from "./run-state.js";
import {
  MockModelAdapter,
  validateModelProposal,
} from "./model-adapter.js";
import { createDefaultWorkflowRegistry } from "@codex-bank-teller/workflow-registry";
import { createDefaultToolRegistry } from "@codex-bank-teller/tool-gateway";

describe("agent run state machine", () => {
  it("creates a run and allows only legal transitions", () => {
    const run = createRun("account.balance.read", "synthetic-teller");

    expect(run).toMatchObject({
      workflowId: "account.balance.read",
      actorType: "synthetic-teller",
      status: "created",
    });
    expect(run.runId).toMatch(/^RUN-/);

    const classified = transitionRun(run, "classified");
    const approved = transitionRun(classified, "approved");
    const executing = transitionRun(approved, "executing");
    const verifying = transitionRun(executing, "verifying");
    const completed = transitionRun(verifying, "completed");

    expect(completed.status).toBe("completed");
    expect(completed.events.map((event) => event.to)).toEqual([
      "classified",
      "approved",
      "executing",
      "verifying",
      "completed",
    ]);
  });

  it("rejects illegal and post-terminal transitions", () => {
    const run = createRun("account.balance.read", "synthetic-teller");

    expect(() => transitionRun(run, "completed")).toThrowError(
      "INVALID_RUN_TRANSITION",
    );

    const terminal = ["completed", "handoff", "denied", "failed"] as RunStatus[];
    for (const status of terminal) {
      const terminalRun = { ...run, status };
      expect(() => transitionRun(terminalRun, "executing")).toThrowError(
        "RUN_TERMINAL",
      );
    }
  });

  it("supports explicit handoff and failure exits", () => {
    const run = createRun("account.balance.read", "synthetic-teller");

    expect(transitionRun(run, "classified").status).toBe("classified");
    expect(transitionRun(run, "handoff").status).toBe("handoff");
    expect(transitionRun(run, "denied").status).toBe("denied");
    expect(transitionRun(run, "failed").status).toBe("failed");
  });

  it("uses the offline model adapter for the balance slice", async () => {
    const adapter = new MockModelAdapter();
    const proposal = await adapter.propose({
      text: "查询测试账户 ACC-1001 当前余额",
    });

    expect(proposal).toEqual({
      kind: "tool_call",
      workflowId: "account.balance.read",
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001" },
    });
    expect(() =>
      validateModelProposal(
        proposal,
        createDefaultWorkflowRegistry(),
        createDefaultToolRegistry(),
      ),
    ).not.toThrow();
  });

  it("rejects unknown workflow and tool proposals", () => {
    const registry = createDefaultWorkflowRegistry();
    const tools = createDefaultToolRegistry();

    expect(() =>
      validateModelProposal(
        {
          kind: "tool_call",
          workflowId: "unknown.workflow",
          toolName: "account.balance.read",
          input: {},
        },
        registry,
        tools,
      ),
    ).toThrowError("WORKFLOW_NOT_REGISTERED");

    expect(() =>
      validateModelProposal(
        {
          kind: "tool_call",
          workflowId: "account.balance.read",
          toolName: "admin.transfer.execute",
          input: {},
        },
        registry,
        tools,
      ),
    ).toThrowError("TOOL_NOT_REGISTERED");
  });
});
