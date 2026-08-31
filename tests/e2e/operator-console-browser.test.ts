import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import type { Page } from "playwright";
import { InMemoryBrowserHarness } from "@codex-bank-teller/browser-harness";
import {
  createReviewCase,
  type ReviewCase,
} from "../../apps/operator-console/src/review/index.js";
import {
  createOperatorConsoleBrowserFixture,
  type OperatorConsoleBrowserFixture,
} from "../helpers/operator-console-browser.js";

const fixtures: OperatorConsoleBrowserFixture[] = [];

function createCase(overrides: Partial<ReviewCase> = {}): ReviewCase {
  return createReviewCase({
    runId: "RUN-BROWSER-1001",
    synthetic: true,
    customerContext: "CUST-1001（合成客户）",
    suggestedAction: "查询合成账户余额",
    riskLevel: "green",
    policyDecision: "allow",
    verificationStatus: "verified",
    citations: [
      {
        documentId: "POLICY-IDENTITY-001",
        version: "2026-08-01",
        excerpt: "查询账户余额前必须核对客户标识与账户归属。",
      },
    ],
    auditEventIds: ["EV-BROWSER-1001"],
    ...overrides,
  });
}

async function createFixture(overrides: Partial<ReviewCase> = {}) {
  const fixture = await createOperatorConsoleBrowserFixture({
    review: createCase(overrides),
  });
  fixtures.push(fixture);
  return fixture;
}

async function waitForText(page: Page, testId: string, expected: string): Promise<void> {
  await page.waitForFunction(
    ({ testId: currentTestId, expected: expectedText }) =>
      document.querySelector(`[data-testid="${currentTestId}"]`)?.textContent?.includes(expectedText) ?? false,
    { testId, expected },
  );
}

afterEach(async () => {
  while (fixtures.length > 0) {
    await fixtures.pop()?.close();
  }
});

describe("operator console browser acceptance", () => {
  it("shows the synthetic context and confirms an allowed verified review", async () => {
    const fixture = await createFixture();
    const page = await fixture.browser.newPage();

    await page.goto(`${fixture.baseUrl}/review/${fixture.review.runId}`);
    expect(await page.getByTestId("customer-context").textContent()).toContain("CUST-1001");
    expect(await page.getByTestId("run-id").textContent()).toContain("RUN-BROWSER-1001");
    expect(await page.getByTestId("action-confirm").isEnabled()).toBe(true);
    expect(new URL(page.url()).hostname).toBe("127.0.0.1");

    await page.getByTestId("action-confirm").click();
    await waitForText(page, "review-status", "confirmed");
    expect(await page.getByTestId("review-executed").textContent()).toContain("false");
    expect(await page.getByTestId("action-confirm").isEnabled()).toBe(false);

    const audit = await readFile(fixture.auditLogPath, "utf8");
    expect(audit).toContain('"result":"review_accepted"');
    expect(audit).not.toContain("password");
  });

  it("keeps confirmation disabled when policy needs confirmation and allows handoff", async () => {
    const fixture = await createFixture({ policyDecision: "confirm" });
    const page = await fixture.browser.newPage();

    await page.goto(`${fixture.baseUrl}/review/${fixture.review.runId}`);
    expect(await page.getByTestId("action-confirm").isEnabled()).toBe(false);
    expect(await page.getByTestId("action-handoff").isEnabled()).toBe(true);

    await page.getByTestId("action-handoff").click();
    await waitForText(page, "review-status", "handed_off");
    expect(await page.getByTestId("action-reject").isEnabled()).toBe(false);
    const audit = await readFile(fixture.auditLogPath, "utf8");
    expect(audit).toContain('"action":"handoff"');
    expect(audit).toContain('"result":"review_accepted"');
  });

  it("restores only the actions allowed by policy after a rejected request", async () => {
    const fixture = await createFixture({ policyDecision: "confirm" });
    const page = await fixture.browser.newPage();

    await page.goto(`${fixture.baseUrl}/review/${fixture.review.runId}`);
    await page.getByTestId("action-modify").click();
    await waitForText(page, "review-error", "MODIFICATION_NOTE_REQUIRED");
    expect(await page.getByTestId("action-confirm").isEnabled()).toBe(false);
    expect(await page.getByTestId("action-modify").isEnabled()).toBe(true);
  });

  it("requires a note for modification and records the modified state", async () => {
    const fixture = await createFixture();
    const page = await fixture.browser.newPage();

    await page.goto(`${fixture.baseUrl}/review/${fixture.review.runId}`);
    await page.getByTestId("action-modify").click();
    await waitForText(page, "review-error", "MODIFICATION_NOTE_REQUIRED");
    expect(await page.getByTestId("action-modify").isEnabled()).toBe(true);

    await page.getByTestId("action-note").fill("仅查询账户，不展示完整客户名称");
    await page.getByTestId("action-modify").click();
    await waitForText(page, "review-status", "modified");
    expect(await page.getByTestId("review-executed").textContent()).toContain("false");
    const audit = await readFile(fixture.auditLogPath, "utf8");
    expect(audit.match(/"action":"modify"/g)).toHaveLength(2);
    expect(audit).toContain('"result":"review_rejected"');
    expect(audit).toContain('"result":"review_accepted"');
  });

  it("enters rejected terminal state and disables all later actions", async () => {
    const fixture = await createFixture();
    const page = await fixture.browser.newPage();

    await page.goto(`${fixture.baseUrl}/review/${fixture.review.runId}`);
    await page.getByTestId("action-reject").click();
    await waitForText(page, "review-status", "rejected");
    for (const action of ["confirm", "modify", "handoff", "reject"]) {
      expect(await page.getByTestId(`action-${action}`).isEnabled()).toBe(false);
    }
    const audit = await readFile(fixture.auditLogPath, "utf8");
    expect(audit).toContain('"action":"reject"');
    expect(audit).toContain('"result":"review_accepted"');
  });

  it("keeps browser navigation limited to the local origin policy", async () => {
    const fixture = await createFixture();
    const harness = new InMemoryBrowserHarness([fixture.baseUrl]);
    const observation = await harness.open(`${fixture.baseUrl}/health`);

    expect(new URL(observation.url).hostname).toBe("127.0.0.1");
    await expect(
      harness.open("https://real-bank.example/login"),
    ).rejects.toThrowError("EXTERNAL_DOMAIN_DENIED");
  });
});
