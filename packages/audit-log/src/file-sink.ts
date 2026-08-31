import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { redactSensitive } from "@codex-bank-teller/tool-gateway";

export interface AuditEventInput {
  runId: string;
  actorId?: string;
  actorType: string;
  workflowId: string;
  toolName?: string;
  input: unknown;
  policyDecision: string;
  result: string;
  output?: unknown;
  terminationReason?: string;
}

export interface AuditEvent {
  eventId: string;
  runId: string;
  timestamp: string;
  actorId?: string;
  actorType: string;
  workflowId: string;
  toolName?: string;
  inputHash: string;
  redactedOutput: unknown;
  policyDecision: string;
  result: string;
  terminationReason?: string;
  synthetic: true;
}

export class FileAuditLog {
  public constructor(
    private readonly filePath: string,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  public async append(input: AuditEventInput): Promise<AuditEvent> {
    const redacted = redactSensitive(input.output ?? null);
    const event: AuditEvent = {
      eventId: `EV-${randomUUID()}`,
      runId: input.runId,
      timestamp: this.now(),
      actorId: input.actorId,
      actorType: input.actorType,
      workflowId: input.workflowId,
      toolName: input.toolName,
      inputHash: hashStable(input.input),
      redactedOutput: redacted.value,
      policyDecision: input.policyDecision,
      result: input.result,
      terminationReason: input.terminationReason,
      synthetic: true,
    };
    await mkdir(dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(event)}\n`, "utf8");
    return event;
  }

  public async listByRun(runId: string): Promise<AuditEvent[]> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
    return raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEvent)
      .filter((event) => event.runId === runId);
  }
}

function hashStable(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value))
    .digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
