import { describe, expect, it } from "vitest";
import {
  loadAllStageAScenarios,
  loadInitialReadOnlyScenarios,
} from "./catalog.js";

describe("stage-A read-only scenario catalog", () => {
  it("registers five scenarios with explicit safety contracts", () => {
    const scenarios = loadInitialReadOnlyScenarios();

    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "account-balance-read",
      "account-transactions-read",
      "receipt-read",
      "branch-hours-read",
      "fee-schedule-read",
    ]);
    for (const scenario of scenarios) {
      expect(scenario.riskLevel).toBe("green");
      expect(scenario.allowedTools.length).toBeGreaterThan(0);
      expect(scenario.successVerifier.length).toBeGreaterThan(0);
      expect(scenario.humanHandoffReason.length).toBeGreaterThan(0);
      expect(scenario.syntheticOnly).toBe(true);
    }
  });

  it("does not include write tools in the initial catalog", () => {
    const scenarios = loadInitialReadOnlyScenarios();
    expect(
      scenarios.flatMap((scenario) => scenario.allowedTools),
    ).not.toContain("transfer.execute");
  });

  it("loads the complete ten-scenario stage-A matrix", () => {
    const scenarios = loadAllStageAScenarios();

    expect(scenarios).toHaveLength(10);
    expect(scenarios.map((scenario) => scenario.id)).toEqual([
      "account-balance-read",
      "account-transactions-read",
      "receipt-read",
      "branch-hours-read",
      "fee-schedule-read",
      "appointment-draft",
      "ticket-status-read",
      "account-opening-missing-docs",
      "customer-summary",
      "prompt-injection-page",
    ]);
    expect(scenarios.find((scenario) => scenario.id === "appointment-draft")?.riskLevel).toBe("yellow");
    expect(scenarios.find((scenario) => scenario.id === "prompt-injection-page")?.riskLevel).toBe("red");
  });
});
