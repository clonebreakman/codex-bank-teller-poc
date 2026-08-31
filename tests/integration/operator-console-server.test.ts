import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileAuditLog } from "@codex-bank-teller/audit-log";
import {
  createReviewCase,
  type ReviewCase,
} from "../../apps/operator-console/src/review/index.js";
import { startOperatorConsoleServer } from "../../apps/operator-console/src/server.js";

const handles: Array<{ close(): Promise<void> }> = [];

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

async function start(review: ReviewCase = createCase()) {
  const directory = await mkdtemp(join(tmpdir(), "codex-bank-console-"));
  const auditLog = new FileAuditLog(join(directory, "events.jsonl"));
  const handle = await startOperatorConsoleServer({ cases: [review], auditLog });
  handles.push(handle);
  return { handle, review, auditLog };
}

afterEach(async () => {
  while (handles.length > 0) {
    await handles.pop()?.close();
  }
});

describe("operator console local HTTP server", () => {
  it("serves a synthetic-only health check and review page on loopback", async () => {
    const { handle, review } = await start();

    const health = await fetch(`${handle.url}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, syntheticOnly: true });

    const page = await fetch(`${handle.url}/review/${review.runId}`);
    expect(page.status).toBe(200);
    expect(page.headers.get("content-type")).toContain("text/html");
    expect(await page.text()).toContain("CUST-1001");
  });

  it("confirms through the domain service, updates the page, and records audit", async () => {
    const { handle, review, auditLog } = await start();

    const response = await fetch(`${handle.url}/review/${review.runId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", actorId: "TELLER-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      review: { status: "confirmed", executed: false },
      auditEvent: { action: "confirm", result: "accepted" },
    });
    expect((await fetch(`${handle.url}/review/${review.runId}`)).status).toBe(200);
    const events = await auditLog.listByRun(review.runId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ result: "review_accepted", synthetic: true });
  });

  it("returns stable domain rejection and records it without changing the case", async () => {
    const review = createCase({ policyDecision: "confirm" });
    const { handle, auditLog } = await start(review);

    const response = await fetch(`${handle.url}/review/${review.runId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", actorId: "TELLER-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: false,
      reason: "REVIEW_NOT_READY",
    });
    expect(await auditLog.listByRun(review.runId)).toHaveLength(1);
  });

  it("rejects malformed requests, unknown cases, non-synthetic actors, and oversized bodies", async () => {
    const { handle, review } = await start();

    const emptyNote = await fetch(`${handle.url}/review/${review.runId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "modify", actorId: "TELLER-1", note: "   " }),
    });
    expect(await emptyNote.json()).toMatchObject({
      ok: false,
      reason: "MODIFICATION_NOTE_REQUIRED",
    });

    const unknownAction = await fetch(`${handle.url}/review/${review.runId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "transfer", actorId: "TELLER-1" }),
    });
    expect(unknownAction.status).toBe(400);
    expect(await unknownAction.json()).toEqual({ ok: false, reason: "INVALID_ACTION_REQUEST" });

    const unknownRun = await fetch(`${handle.url}/review/RUN-UNKNOWN/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", actorId: "TELLER-1" }),
    });
    expect(unknownRun.status).toBe(404);

    const externalActor = await fetch(`${handle.url}/review/${review.runId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", actorId: "BANK-ADMIN" }),
    });
    expect(externalActor.status).toBe(400);
    expect(await externalActor.json()).toEqual({
      ok: false,
      reason: "SYNTHETIC_ACTOR_REQUIRED",
    });

    const oversized = await fetch(`${handle.url}/review/${review.runId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", actorId: "TELLER-1", note: "x".repeat(17 * 1024) }),
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ ok: false, reason: "INVALID_ACTION_REQUEST" });
  });

  it("returns JSON 404 for unknown paths", async () => {
    const { handle } = await start();
    const response = await fetch(`${handle.url}/external.example`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("serializes concurrent actions for one review and rejects the duplicate", async () => {
    const { handle, review, auditLog } = await start();
    const body = JSON.stringify({ action: "confirm", actorId: "TELLER-1" });

    const responses = await Promise.all(
      [1, 2].map(() =>
        fetch(`${handle.url}/review/${review.runId}/action`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        }),
      ),
    );
    const payloads = await Promise.all(responses.map((response) => response.json()));

    expect(payloads.filter((payload) => payload.ok === true)).toHaveLength(1);
    expect(payloads.filter((payload) => payload.reason === "REVIEW_DUPLICATE_ACTION")).toHaveLength(1);
    expect((await auditLog.listByRun(review.runId)).filter(
      (event) => event.result === "review_accepted",
    )).toHaveLength(1);
  });

  it("rejects unknown action fields instead of silently accepting them", async () => {
    const { handle, review } = await start();
    const response = await fetch(`${handle.url}/review/${review.runId}/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "confirm", actorId: "TELLER-1", debug: true }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason: "INVALID_ACTION_REQUEST" });
  });
});
