import type { ToolRegistry } from "@codex-bank-teller/tool-gateway";
import type {
  WorkflowDefinition,
  WorkflowRegistry,
} from "@codex-bank-teller/workflow-registry";

export type ModelProposal =
  | {
      kind: "tool_call";
      workflowId: string;
      toolName: string;
      input: Record<string, unknown>;
    }
  | {
      kind: "handoff";
      reason: string;
    };

export interface ModelAdapter {
  propose(input: { text: string }): Promise<ModelProposal>;
}

export class MockModelAdapter implements ModelAdapter {
  public async propose(input: { text: string }): Promise<ModelProposal> {
    const accountId = input.text.match(/ACC-\d{4}/)?.[0];
    if (accountId && /(余额|balance)/i.test(input.text)) {
      return {
        kind: "tool_call",
        workflowId: "account.balance.read",
        toolName: "account.balance.read",
        input: { accountId },
      };
    }
    return {
      kind: "handoff",
      reason: "MOCK_MODEL_UNSUPPORTED_REQUEST",
    };
  }
}

export function validateModelProposal(
  proposal: ModelProposal,
  workflows: WorkflowRegistry,
  tools: ToolRegistry,
): { workflow: WorkflowDefinition; toolName: string } | void {
  if (proposal.kind === "handoff") {
    return;
  }
  const workflow = workflows.get(proposal.workflowId);
  if (!workflow) {
    throw new Error("WORKFLOW_NOT_REGISTERED");
  }
  const tool = tools.get(proposal.toolName);
  if (!tool) {
    throw new Error("TOOL_NOT_REGISTERED");
  }
  if (!workflow.allowedTools.includes(proposal.toolName)) {
    throw new Error("TOOL_NOT_ALLOWED");
  }
  return { workflow, toolName: tool.name };
}
