import { describe, expect, it } from "vitest";
import {
  createStageAWorkflowRegistry,
} from "@codex-bank-teller/workflow-registry";
import {
  createStageAToolRegistry,
  executeTool,
} from "@codex-bank-teller/tool-gateway";
import { MockBankService } from "@codex-bank-teller/mock-bank/service";
import {
  verifyAccountBalance,
  verifyBranchHours,
  verifyFeeSchedule,
  verifyReceipt,
  verifyTransactionList,
} from "@codex-bank-teller/verification";

describe("stage-A five read-only scenarios", () => {
  it("executes every registered scenario through policy and tool gateway", async () => {
    const workflows = createStageAWorkflowRegistry();
    const bank = new MockBankService({
      now: () => "2026-08-22T00:00:00.000Z",
    });
    const tools = createStageAToolRegistry(bank);
    const requests = [
      {
        workflowId: "account.balance.read",
        toolName: "account.balance.read",
        input: { accountId: "ACC-1001", customerId: "CUST-1001" },
      },
      {
        workflowId: "account.transactions.read",
        toolName: "account.transactions.read",
        input: { accountId: "ACC-1001", customerId: "CUST-1001", limit: 10 },
      },
      {
        workflowId: "receipt.read",
        toolName: "receipt.read",
        input: { receiptId: "REC-1001" },
      },
      {
        workflowId: "branch.hours.read",
        toolName: "branch.hours.read",
        input: { branchId: "BR-1001", date: "2026-08-22" },
      },
      {
        workflowId: "fee.schedule.read",
        toolName: "fee.schedule.read",
        input: { productId: "CHECKING-USD" },
      },
    ];

    for (const [index, request] of requests.entries()) {
      const result = await executeTool(tools, {
        workflow: workflows.get(request.workflowId),
        toolName: request.toolName,
        input: request.input,
        syntheticIdentity: true,
        identityMatches: true,
        externalDomain: false,
        verificationAvailable: true,
        requestId: `REQ-SCENARIO-${index}`,
        toolCallId: `CALL-SCENARIO-${index}`,
      });

      expect(result).toMatchObject({ ok: true, decision: "allow" });
      if (!result.ok) {
        throw new Error(`Scenario failed: ${result.code}`);
      }
      if (Array.isArray(result.data)) {
        expect(result.data.length).toBeGreaterThan(0);
        expect(result.data.every((item) => item.synthetic === true)).toBe(true);
      } else {
        expect(result.data).toMatchObject({ synthetic: true });
      }

      const verification =
        request.toolName === "account.balance.read"
          ? verifyAccountBalance(bank, {
              accountId: "ACC-1001",
              customerId: "CUST-1001",
              claimed: result.data as {
                accountId?: string;
                currency?: string;
                balanceMinor?: number;
                asOf?: string;
                synthetic?: boolean;
              },
            })
          : request.toolName === "account.transactions.read"
            ? verifyTransactionList(bank, {
                accountId: "ACC-1001",
                customerId: "CUST-1001",
                limit: 10,
                claimed: result.data as unknown[],
              })
            : request.toolName === "receipt.read"
              ? verifyReceipt(bank, {
                  receiptId: "REC-1001",
                  claimed: result.data,
                })
              : request.toolName === "branch.hours.read"
                ? verifyBranchHours(bank, {
                    branchId: "BR-1001",
                    date: "2026-08-22",
                    claimed: result.data,
                  })
                : verifyFeeSchedule(bank, {
                    productId: "CHECKING-USD",
                    claimed: result.data,
                  });
      expect(verification.verified).toBe(true);
    }
  });

  it("stops the scenario flow on an identity mismatch", async () => {
    const workflows = createStageAWorkflowRegistry();
    const tools = createStageAToolRegistry();
    const result = await executeTool(tools, {
      workflow: workflows.get("account.balance.read"),
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001", customerId: "CUST-9999" },
      syntheticIdentity: true,
      identityMatches: false,
      externalDomain: false,
      verificationAvailable: true,
      requestId: "REQ-SCENARIO-FAIL",
      toolCallId: "CALL-SCENARIO-FAIL",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "POLICY_DENIED",
      decision: "handoff",
      reasonCode: "IDENTITY_MISMATCH",
    });
  });
});
