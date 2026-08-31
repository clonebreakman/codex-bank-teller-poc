import { z } from "zod";

export const workflowDefinitionSchema = z.object({
  workflowId: z.string().min(1),
  riskLevel: z.enum(["green", "yellow", "red"]),
  requiredContext: z.array(z.string().min(1)).min(1),
  allowedTools: z.array(z.string().min(1)),
  successVerifier: z.string(),
  humanHandoffReason: z.string().min(1),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowRegistry = ReturnType<typeof createWorkflowRegistry>;

export const accountBalanceReadWorkflow: WorkflowDefinition = {
  workflowId: "account.balance.read",
  riskLevel: "green",
  requiredContext: ["customerId", "accountId"],
  allowedTools: ["account.balance.read"],
  successVerifier: "account-balance-verifier",
  humanHandoffReason: "Unable to verify account balance safely",
};

export const accountTransactionsReadWorkflow: WorkflowDefinition = {
  ...accountBalanceReadWorkflow,
  workflowId: "account.transactions.read",
  allowedTools: ["account.transactions.read"],
  successVerifier: "account-transactions-verifier",
};

export const receiptReadWorkflow: WorkflowDefinition = {
  ...accountBalanceReadWorkflow,
  workflowId: "receipt.read",
  requiredContext: ["receiptId"],
  allowedTools: ["receipt.read"],
  successVerifier: "receipt-verifier",
};

export const branchHoursReadWorkflow: WorkflowDefinition = {
  ...accountBalanceReadWorkflow,
  workflowId: "branch.hours.read",
  requiredContext: ["branchId", "date"],
  allowedTools: ["branch.hours.read"],
  successVerifier: "branch-hours-verifier",
};

export const feeScheduleReadWorkflow: WorkflowDefinition = {
  ...accountBalanceReadWorkflow,
  workflowId: "fee.schedule.read",
  requiredContext: ["productId"],
  allowedTools: ["fee.schedule.read"],
  successVerifier: "fee-schedule-verifier",
};

export const appointmentDraftWorkflow: WorkflowDefinition = {
  ...accountBalanceReadWorkflow,
  workflowId: "appointment.draft",
  riskLevel: "yellow",
  requiredContext: ["customerId", "date"],
  allowedTools: ["appointment.draft.create"],
  successVerifier: "appointment-draft-verifier",
};

export const ticketStatusReadWorkflow: WorkflowDefinition = {
  ...accountBalanceReadWorkflow,
  workflowId: "ticket.status.read",
  requiredContext: ["ticketId"],
  allowedTools: ["ticket.status.read"],
  successVerifier: "ticket-status-verifier",
};

export const missingDocumentsReadWorkflow: WorkflowDefinition = {
  ...accountBalanceReadWorkflow,
  workflowId: "account.opening.missing-docs.read",
  requiredContext: ["customerId"],
  allowedTools: ["account.opening.missing-docs.read"],
  successVerifier: "missing-documents-verifier",
};

export const customerSummaryReadWorkflow: WorkflowDefinition = {
  ...accountBalanceReadWorkflow,
  workflowId: "customer.summary.read",
  requiredContext: ["customerId"],
  allowedTools: ["customer.summary.read"],
  successVerifier: "customer-summary-verifier",
};

export function createWorkflowRegistry() {
  const workflows = new Map<string, WorkflowDefinition>();

  return {
    get(workflowId: string): WorkflowDefinition | undefined {
      return workflows.get(workflowId);
    },
    list(): WorkflowDefinition[] {
      return [...workflows.values()];
    },
    register(workflow: WorkflowDefinition): void {
      registerWorkflowIntoMap(workflows, workflow);
    },
  };
}

export function createDefaultWorkflowRegistry(): WorkflowRegistry {
  const registry = createWorkflowRegistry();
  registerWorkflow(registry, accountBalanceReadWorkflow);
  registerWorkflow(registry, accountTransactionsReadWorkflow);
  registerWorkflow(registry, receiptReadWorkflow);
  return registry;
}

export function createStageAWorkflowRegistry(): WorkflowRegistry {
  const registry = createDefaultWorkflowRegistry();
  registerWorkflow(registry, branchHoursReadWorkflow);
  registerWorkflow(registry, feeScheduleReadWorkflow);
  registerWorkflow(registry, appointmentDraftWorkflow);
  registerWorkflow(registry, ticketStatusReadWorkflow);
  registerWorkflow(registry, missingDocumentsReadWorkflow);
  registerWorkflow(registry, customerSummaryReadWorkflow);
  return registry;
}

export function registerWorkflow(
  registry: WorkflowRegistry,
  workflow: WorkflowDefinition,
): void {
  registry.register(workflow);
}

function registerWorkflowIntoMap(
  workflows: Map<string, WorkflowDefinition>,
  workflow: WorkflowDefinition,
): void {
  if (workflows.has(workflow.workflowId)) {
    throw new Error("WORKFLOW_DUPLICATE");
  }
  if (workflow.allowedTools.length === 0) {
    throw new Error("WORKFLOW_TOOLS_EMPTY");
  }
  if (workflow.successVerifier.trim().length === 0) {
    throw new Error("WORKFLOW_VERIFIER_MISSING");
  }

  const parsed = workflowDefinitionSchema.safeParse(workflow);
  if (!parsed.success) {
    throw new Error("WORKFLOW_INVALID");
  }
  workflows.set(workflow.workflowId, parsed.data);
}
