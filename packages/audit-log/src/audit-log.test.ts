import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FileAuditLog } from "./file-sink.js";

describe("append-only audit log", () => {
  it("stores a queryable event with a stable input hash", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-bank-audit-"));
    const file = join(directory, "events.jsonl");
    const log = new FileAuditLog(file, () => "2026-08-22T00:00:00.000Z");

    const first = await log.append({
      runId: "RUN-1001",
      actorType: "synthetic-teller",
      workflowId: "account.balance.read",
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001" },
      policyDecision: "allow",
      result: "success",
      output: { accountId: "ACC-1001", balanceMinor: 125000 },
    });
    const second = await log.append({
      runId: "RUN-1001",
      actorType: "synthetic-teller",
      workflowId: "account.balance.read",
      toolName: "account.balance.read",
      input: { accountId: "ACC-1001" },
      policyDecision: "allow",
      result: "success",
      output: { accountId: "ACC-1001", balanceMinor: 125000 },
    });

    expect(first.eventId).not.toBe(second.eventId);
    expect(first.inputHash).toBe(second.inputHash);
    expect(await log.listByRun("RUN-1001")).toHaveLength(2);

    const raw = await readFile(file, "utf8");
    expect(raw).not.toContain("123456");
  });

  it("redacts credentials and display names before writing", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-bank-audit-"));
    const file = join(directory, "events.jsonl");
    const log = new FileAuditLog(file);

    await log.append({
      runId: "RUN-1002",
      actorType: "synthetic-teller",
      workflowId: "account.balance.read",
      input: { accountId: "ACC-1001", otp: "123456" },
      policyDecision: "deny",
      result: "denied",
      output: { displayName: "Synthetic Customer", pin: "0000" },
      terminationReason: "POLICY_DENIED",
    });

    const events = await log.listByRun("RUN-1002");
    expect(events[0].redactedOutput).toEqual({
      displayName: "[REDACTED]",
      pin: "[REDACTED]",
    });
    expect(JSON.stringify(events[0])).not.toContain("123456");
    expect(JSON.stringify(events[0])).not.toContain("0000");
  });

  it("keeps the synthetic actor identity queryable", async () => {
    const directory = await mkdtemp(join(tmpdir(), "codex-bank-audit-"));
    const file = join(directory, "events.jsonl");
    const log = new FileAuditLog(file);

    await log.append({
      runId: "RUN-1003",
      actorId: "TELLER-1",
      actorType: "synthetic-teller",
      workflowId: "operator.review",
      input: { action: "modify" },
      policyDecision: "allow",
      result: "review_accepted",
      output: { modificationNoteHash: "hash-1", modificationNoteLength: 8 },
    });

    await expect(log.listByRun("RUN-1003")).resolves.toMatchObject([
      {
        actorId: "TELLER-1",
        redactedOutput: { modificationNoteHash: "hash-1", modificationNoteLength: 8 },
      },
    ]);
  });
});
