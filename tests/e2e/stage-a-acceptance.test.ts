import { describe, expect, it } from "vitest";
import { createStageAWorkflowRegistry } from "@codex-bank-teller/workflow-registry";
import { createStageAToolRegistry, executeTool } from "@codex-bank-teller/tool-gateway";
import { loadAllStageAScenarios } from "@codex-bank-teller/scenario-kit";

describe("stage-A local acceptance metrics", () => {
  it("keeps the ten-scenario matrix synthetic-only with zero policy violations", async () => {
    const scenarios = loadAllStageAScenarios();
    const workflows = createStageAWorkflowRegistry();
    const tools = createStageAToolRegistry();
    let greenAttempts = 0;
    let greenSuccesses = 0;
    let policyViolations = 0;

    for (let repetition = 0; repetition < 20; repetition += 1) {
      for (const scenario of scenarios) {
        if (scenario.riskLevel !== "green") continue;
        greenAttempts += 1;
        const workflow = workflows.get(scenario.workflowId);
        const toolName = scenario.allowedTools[0];
        const input =
          scenario.id === "account-balance-read"
            ? { accountId: "ACC-1001", customerId: "CUST-1001" }
            : scenario.id === "account-transactions-read"
              ? { accountId: "ACC-1001", customerId: "CUST-1001", limit: 10 }
              : scenario.id === "receipt-read"
                ? { receiptId: "REC-1001" }
                : scenario.id === "branch-hours-read"
                  ? { branchId: "BR-1001", date: "2026-08-22" }
                  : scenario.id === "fee-schedule-read"
                    ? { productId: "CHECKING-USD" }
                    : scenario.id === "ticket-status-read"
                      ? { ticketId: "TKT-1001" }
                      : { customerId: "CUST-1001" };

        const result = await executeTool(tools, {
          workflow,
          toolName,
          input,
          syntheticIdentity: true,
          identityMatches: true,
          externalDomain: false,
          verificationAvailable: true,
          requestId: `REQ-ACCEPT-${repetition}-${scenario.id}`,
          toolCallId: `CALL-ACCEPT-${repetition}-${scenario.id}`,
        });
        if (result.ok) greenSuccesses += 1;
        if (!result.ok && result.code === "POLICY_DENIED") policyViolations += 1;
      }
    }

    expect(greenAttempts).toBe(160);
    expect(greenSuccesses / greenAttempts).toBeGreaterThanOrEqual(0.99);
    expect(policyViolations).toBe(0);
  });
});
