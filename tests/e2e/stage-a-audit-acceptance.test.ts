import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileAuditLog } from "@codex-bank-teller/audit-log";
import { loadAllStageAScenarios } from "@codex-bank-teller/scenario-kit";
import { verifyStageAAuditCompleteness } from "@codex-bank-teller/verification";

describe("stage-A audit acceptance", () => {
  it("verifies complete audit coverage for all ten scenarios", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-bank-stage-a-audit-"));
    const auditLog = new FileAuditLog(join(directory, "events.jsonl"));
    const scenarios = loadAllStageAScenarios();

    for (const scenario of scenarios) {
      await auditLog.append({
        runId: `RUN-${scenario.id}`,
        actorType: "synthetic-teller",
        workflowId: scenario.workflowId,
        toolName: scenario.allowedTools[0],
        input: { scenarioId: scenario.id },
        policyDecision: scenario.riskLevel === "yellow" ? "confirm" : scenario.riskLevel === "red" ? "deny" : "allow",
        result: scenario.riskLevel === "red" ? "security_event" : scenario.riskLevel === "yellow" ? "confirmation_required" : "success",
        output: { scenarioId: scenario.id },
        terminationReason: scenario.riskLevel === "red" ? "PROMPT_INJECTION_DETECTED" : undefined,
      });
    }

    const result = verifyStageAAuditCompleteness({
      scenarios,
      events: await Promise.all(
        scenarios.map((scenario) => auditLog.listByRun(`RUN-${scenario.id}`)),
      ).then((runs) => runs.flat()),
    });

    expect(result).toEqual({
      verified: true,
      coverage: 1,
      missingScenarioIds: [],
      invalidEventIds: [],
      verificationCode: "STAGE_A_AUDIT_COMPLETE",
    });
  });

  it("rejects a scenario with no complete audit event", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-bank-stage-a-audit-"));
    const auditLog = new FileAuditLog(join(directory, "events.jsonl"));
    const scenarios = loadAllStageAScenarios();

    for (const scenario of scenarios.slice(0, -1)) {
      await auditLog.append({
        runId: `RUN-${scenario.id}`,
        actorType: "synthetic-teller",
        workflowId: scenario.workflowId,
        toolName: scenario.allowedTools[0],
        input: { scenarioId: scenario.id },
        policyDecision: "allow",
        result: "success",
      });
    }

    const result = verifyStageAAuditCompleteness({
      scenarios,
      events: await Promise.all(
        scenarios.slice(0, -1).map((scenario) => auditLog.listByRun(`RUN-${scenario.id}`)),
      ).then((runs) => runs.flat()),
    });

    expect(result.verified).toBe(false);
    expect(result.coverage).toBe(0.9);
    expect(result.missingScenarioIds).toEqual(["prompt-injection-page"]);
    expect(result.verificationCode).toBe("STAGE_A_AUDIT_INCOMPLETE");
  });
});
