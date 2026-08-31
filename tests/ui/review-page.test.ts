import { describe, expect, it } from "vitest";
import { createReviewCase, type ReviewCase } from "../../apps/operator-console/src/review/index.js";
import { renderReviewPage, type ReviewPageOptions } from "../../apps/operator-console/src/ui/review-page.js";

function createCase(overrides: Partial<ReviewCase> = {}): ReviewCase {
  return createReviewCase({
    runId: "RUN-REVIEW-1001",
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
    auditEventIds: ["EV-REVIEW-1001"],
    ...overrides,
  });
}

const options: ReviewPageOptions = {
  actionEndpoint: "/review/RUN-REVIEW-1001/action",
  actorId: "TELLER-1",
};

describe("operator review page renderer", () => {
  it.each(["console-shell", "console-sidebar", "risk-summary", "system-status"])(
    "renders the %s command-center region",
    (testId) => {
      const html = renderReviewPage(createCase(), options);

      expect(html).toContain(`data-testid="${testId}"`);
    },
  );

  it("renders a green status badge", () => {
    const html = renderReviewPage(createCase(), options);

    expect(html).toMatch(
      /<[^>]*(?=[^>]*data-testid="status-badge")(?=[^>]*class="[^"]*\bstatus-green\b)[^>]*>/,
    );
  });

  it("renders the complete synthetic review context and action controls", () => {
    const html = renderReviewPage(createCase(), options);

    expect(html).toContain('data-testid="customer-context"');
    expect(html).toContain("CUST-1001");
    expect(html).toContain("RUN-REVIEW-1001");
    expect(html).toContain("查询合成账户余额");
    expect(html).toContain("green");
    expect(html).toContain("allow");
    expect(html).toContain("verified");
    expect(html).toContain("POLICY-IDENTITY-001");
    expect(html).toContain("2026-08-01");
    expect(html).toContain("EV-REVIEW-1001");
    expect(html).toContain('data-testid="action-confirm"');
    expect(html).toContain('data-testid="action-modify"');
    expect(html).toContain('data-testid="action-handoff"');
    expect(html).toContain('data-testid="action-reject"');
    expect(html).toContain('data-testid="action-note"');
    expect(html).toContain('data-testid="review-status"');
    expect(html).toContain('data-testid="review-error"');
    expect(html).toContain("/review/RUN-REVIEW-1001/action");
    expect(html).toContain("executed: false");
    expect(html).not.toContain("tool-gateway");
  });

  it("provides reduced-motion styles for the console", () => {
    const html = renderReviewPage(createCase(), options);

    expect(html).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it.each(["handed_off", "rejected"] as const)(
    "disables all actions when the review is %s",
    (status) => {
      const html = renderReviewPage({ ...createCase(), status }, options);

      for (const action of ["confirm", "modify", "handoff", "reject"]) {
        expect(html).toMatch(
          new RegExp(`<button[^>]*data-testid="action-${action}"[^>]*disabled`),
        );
      }
    },
  );

  it.each([
    { policyDecision: "confirm" as const },
    { verificationStatus: "unverified" as const },
  ])("disables only confirmation for a pending review that is not confirmable", (overrides) => {
    const html = renderReviewPage(createCase(overrides), options);

    expect(html).toMatch(/<button[^>]*data-testid="action-confirm"[^>]*disabled/);
    for (const action of ["modify", "handoff", "reject"]) {
      expect(html).toMatch(
        new RegExp(`<button[^>]*data-testid="action-${action}"(?![^>]*disabled)[^>]*>`),
      );
    }
  });

  it("enables every action for a confirmable pending review", () => {
    const html = renderReviewPage(createCase(), options);

    for (const action of ["confirm", "modify", "handoff", "reject"]) {
      expect(html).toMatch(
        new RegExp(`<button[^>]*data-testid="action-${action}"(?![^>]*disabled)[^>]*>`),
      );
    }
  });

  it("escapes every dynamic field before putting it into HTML", () => {
    const unsafe = `<script data-name="test">'&</script>`;
    const escaped = "&lt;script data-name=&quot;test&quot;&gt;&#39;&amp;&lt;/script&gt;";
    const html = renderReviewPage(
      createCase({
        runId: unsafe,
        customerContext: unsafe,
        suggestedAction: unsafe,
        riskLevel: unsafe,
        policyDecision: unsafe,
        verificationStatus: unsafe,
        citations: [{ documentId: unsafe, version: unsafe, excerpt: unsafe }],
        auditEventIds: [unsafe],
      }),
      { actionEndpoint: unsafe, actorId: unsafe },
    );

    expect(html).not.toContain(unsafe);
    expect(html.match(new RegExp(escaped, "g"))).toHaveLength(16);
  });
});
