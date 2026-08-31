import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileAuditLog } from "@codex-bank-teller/audit-log";
import {
  createReviewCase,
  recordReviewAction,
  reviewAction,
  type ReviewCase,
} from "../../apps/operator-console/src/review/index.js";

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

describe("operator review boundary", () => {
  it("shows the required review context and starts unsubmitted", () => {
    const review = createCase();

    expect(review).toMatchObject({
      status: "pending",
      runId: "RUN-REVIEW-1001",
      synthetic: true,
      customerContext: "CUST-1001（合成客户）",
      suggestedAction: "查询合成账户余额",
      riskLevel: "green",
      policyDecision: "allow",
      verificationStatus: "verified",
      auditEventIds: ["EV-REVIEW-1001"],
    });
    expect(review.executed).toBe(false);
    expect(review.citations[0]).toMatchObject({
      documentId: "POLICY-IDENTITY-001",
      version: "2026-08-01",
    });
  });

  it("requires policy and verification readiness before confirmation", () => {
    const review = createCase({ policyDecision: "confirm" });

    expect(reviewAction(review, { type: "confirm", actorId: "TELLER-1" })).toEqual({
      ok: false,
      reason: "REVIEW_NOT_READY",
      auditEvent: {
        action: "confirm",
        actorId: "TELLER-1",
        runId: review.runId,
        result: "rejected",
      },
    });
  });

  it("supports confirmation and modification without executing a tool", () => {
    const confirmed = reviewAction(createCase(), {
      type: "confirm",
      actorId: "TELLER-1",
    });
    expect(confirmed).toMatchObject({
      ok: true,
      review: { status: "confirmed", executed: false },
      auditEvent: { action: "confirm", result: "accepted" },
    });

    if (!confirmed.ok) throw new Error(confirmed.reason);
    const modified = reviewAction(confirmed.review, {
      type: "modify",
      actorId: "TELLER-1",
      note: "仅查询账户，不展示完整客户名称",
    });
    expect(modified).toMatchObject({
      ok: true,
      review: { status: "modified", executed: false },
      auditEvent: { action: "modify", result: "accepted" },
    });
  });

  it("records handoff and rejection as explicit terminal review actions", () => {
    expect(reviewAction(createCase(), { type: "handoff", actorId: "TELLER-1" })).toMatchObject({
      ok: true,
      review: { status: "handed_off", executed: false },
      auditEvent: { action: "handoff", result: "accepted" },
    });
    expect(reviewAction(createCase(), { type: "reject", actorId: "TELLER-1" })).toMatchObject({
      ok: true,
      review: { status: "rejected", executed: false },
      auditEvent: { action: "reject", result: "accepted" },
    });
  });

  it("persists every accepted or rejected review action to the audit log", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-bank-review-"));
    const auditLog = new FileAuditLog(join(directory, "events.jsonl"));

    const confirmed = await recordReviewAction(auditLog, createCase(), {
      type: "confirm",
      actorId: "TELLER-1",
    });
    expect(confirmed.ok).toBe(true);

    const rejected = await recordReviewAction(auditLog, createCase({ policyDecision: "deny" }), {
      type: "confirm",
      actorId: "TELLER-1",
    });
    expect(rejected.ok).toBe(false);

    const events = await auditLog.listByRun("RUN-REVIEW-1001");
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.result)).toEqual([
      "review_accepted",
      "review_rejected",
    ]);
    expect(events.every((event) => event.synthetic === true)).toBe(true);
  });

  it("keeps the actor and modification-note summary in the audit event", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-bank-review-"));
    const auditLog = new FileAuditLog(join(directory, "events.jsonl"));

    const result = await recordReviewAction(auditLog, createCase(), {
      type: "modify",
      actorId: "TELLER-1",
      note: "仅查询账户，不展示完整客户名称",
    });
    expect(result.ok).toBe(true);

    const [event] = await auditLog.listByRun("RUN-REVIEW-1001");
    expect(event.actorId).toBe("TELLER-1");
    expect(event.redactedOutput).toMatchObject({
      action: "modify",
      modificationNoteLength: "仅查询账户，不展示完整客户名称".length,
    });
    expect(JSON.stringify(event)).not.toContain("仅查询账户，不展示完整客户名称");
  });
});
