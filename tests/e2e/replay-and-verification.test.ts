import { describe, expect, it } from "vitest";
import { replayAuditEvents } from "@codex-bank-teller/verification";

describe("audit replay", () => {
  it("reconstructs an event trace without re-executing tools", () => {
    let executions = 0;
    const replay = replayAuditEvents([
      {
        eventId: "EV-1",
        runId: "RUN-1",
        timestamp: "2026-08-22T00:00:00.000Z",
        actorType: "synthetic-teller",
        workflowId: "account.balance.read",
        toolName: "account.balance.read",
        inputHash: "hash-1",
        redactedOutput: { balanceMinor: 125000 },
        policyDecision: "allow",
        result: "success",
        synthetic: true,
      },
    ], () => {
      executions += 1;
    });

    expect(replay).toEqual({
      runId: "RUN-1",
      steps: [
        {
          eventId: "EV-1",
          workflowId: "account.balance.read",
          toolName: "account.balance.read",
          policyDecision: "allow",
          result: "success",
        },
      ],
    });
    expect(executions).toBe(0);
  });
});
