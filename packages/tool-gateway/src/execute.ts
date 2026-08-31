import {
  decidePolicy,
  type PolicyDecision,
} from "@codex-bank-teller/policy-engine";
import type { WorkflowDefinition } from "@codex-bank-teller/workflow-registry";
import { redactSensitive } from "./redaction.js";
import type { ToolDefinition, ToolRegistry } from "./tool-registry.js";

export interface ExecuteToolRequest {
  workflow?: WorkflowDefinition;
  toolName: string;
  input: Record<string, unknown>;
  syntheticIdentity: boolean;
  identityMatches: boolean;
  externalDomain: boolean;
  verificationAvailable: boolean;
  requestId: string;
  toolCallId: string;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export type ToolExecutionResult =
  | {
      ok: true;
      tool_call_id: string;
      request_id: string;
      decision: "allow";
      data: unknown;
      redaction_summary: { redacted_fields: string[] };
    }
  | {
      ok: false;
      tool_call_id: string;
      request_id: string;
      code: string;
      decision: PolicyDecision["decision"];
      reasonCode?: string;
      redaction_summary: { redacted_fields: string[] };
    };

export async function executeTool(
  registry: ToolRegistry,
  request: ExecuteToolRequest,
): Promise<ToolExecutionResult> {
  const tool = registry.get(request.toolName);
  if (!tool) {
    return failure(request, "TOOL_NOT_REGISTERED", "deny");
  }

  const decision = decidePolicy({
    workflow: request.workflow,
    toolName: request.toolName,
    syntheticIdentity: request.syntheticIdentity,
    identityMatches: request.identityMatches,
    operationClass: tool.operationClass,
    externalDomain: request.externalDomain,
    verificationAvailable: request.verificationAvailable,
  });
  if (decision.decision !== "allow") {
    return failure(request, "POLICY_DENIED", decision.decision, decision.reasonCode);
  }

  const parsed = tool.inputSchema.safeParse(request.input);
  if (!parsed.success) {
    return failure(request, "INPUT_INVALID", decision.decision, decision.reasonCode);
  }

  const cacheKey = request.idempotencyKey
    ? `${tool.name}:v${tool.version}:${request.idempotencyKey}`
    : undefined;
  if (cacheKey) {
    const cached = registry.getIdempotent(cacheKey);
    if (cached !== undefined) {
      return cached as ToolExecutionResult;
    }
  }

  try {
    const data = await withTimeout(
      tool,
      parsed.data as Record<string, unknown>,
      {
        requestId: request.requestId,
        toolCallId: request.toolCallId,
      },
      request.timeoutMs ?? 5000,
    );
    const redacted = redactSensitive(data);
    const result: ToolExecutionResult = {
      ok: true,
      tool_call_id: request.toolCallId,
      request_id: request.requestId,
      decision: "allow",
      data,
      redaction_summary: { redacted_fields: redacted.redactedFields },
    };
    if (cacheKey) {
      registry.setIdempotent(cacheKey, result);
    }
    return result;
  } catch (error) {
    const code = error instanceof Error ? error.message : "EXECUTION_FAILED";
    return failure(
      request,
      code === "EXECUTION_TIMEOUT" ? code : "EXECUTION_FAILED",
      decision.decision,
      decision.reasonCode,
    );
  }
}

async function withTimeout(
  tool: ToolDefinition,
  input: Record<string, unknown>,
  context: { requestId: string; toolCallId: string },
  timeoutMs: number,
): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      tool.execute(input, context),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("EXECUTION_TIMEOUT")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function failure(
  request: ExecuteToolRequest,
  code: string,
  decision: PolicyDecision["decision"],
  reasonCode?: string,
): ToolExecutionResult {
  return {
    ok: false,
    tool_call_id: request.toolCallId,
    request_id: request.requestId,
    code,
    decision,
    reasonCode,
    redaction_summary: { redacted_fields: [] },
  };
}
