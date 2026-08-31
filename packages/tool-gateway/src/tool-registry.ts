import { z } from "zod";
import { MockBankService } from "@codex-bank-teller/mock-bank/service";

export type ToolOperationClass =
  | "read_only"
  | "reversible_write"
  | "irreversible_write";

export interface ToolExecutionContext {
  requestId: string;
  toolCallId: string;
}

export interface ToolDefinition {
  name: string;
  version: number;
  operationClass: ToolOperationClass;
  inputSchema: z.ZodTypeAny;
  execute: (
    input: Record<string, unknown>,
    context: ToolExecutionContext,
  ) => Promise<unknown>;
}

export interface ToolRegistry {
  get(name: string): ToolDefinition | undefined;
  list(): ToolDefinition[];
  register(tool: ToolDefinition): void;
  replace(tool: ToolDefinition): void;
  getIdempotent(key: string): unknown;
  setIdempotent(key: string, value: unknown): void;
}

export function createDefaultToolRegistry(
  service: MockBankService = new MockBankService(),
): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();
  const idempotentResults = new Map<string, unknown>();
  const registry: ToolRegistry = {
    get(name) {
      return tools.get(name);
    },
    list() {
      return [...tools.values()];
    },
    register(tool) {
      if (tools.has(tool.name)) {
        throw new Error("TOOL_DUPLICATE");
      }
      tools.set(tool.name, tool);
    },
    replace(tool) {
      if (!tools.has(tool.name)) {
        throw new Error("TOOL_NOT_REGISTERED");
      }
      tools.set(tool.name, tool);
    },
    getIdempotent(key) {
      return idempotentResults.get(key);
    },
    setIdempotent(key, value) {
      idempotentResults.set(key, value);
    },
  };

  registry.register({
    name: "account.balance.read",
    version: 1,
    operationClass: "read_only",
    inputSchema: z.object({
      accountId: z.string().min(1),
      customerId: z.string().min(1).optional(),
    }),
    execute: async (input) =>
      service.getAccountBalance(
        String(input.accountId),
        input.customerId === undefined ? undefined : String(input.customerId),
      ),
  });
  registry.register({
    name: "account.transactions.read",
    version: 1,
    operationClass: "read_only",
    inputSchema: z.object({
      accountId: z.string().min(1),
      customerId: z.string().min(1).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: async (input) =>
      service.listTransactions(
        String(input.accountId),
        input.limit === undefined ? 10 : Number(input.limit),
        input.customerId === undefined ? undefined : String(input.customerId),
      ),
  });
  registry.register({
    name: "receipt.read",
    version: 1,
    operationClass: "read_only",
    inputSchema: z.object({ receiptId: z.string().min(1) }),
    execute: async (input) => service.getReceipt(String(input.receiptId)),
  });

  return registry;
}

export function createStageAToolRegistry(
  service: MockBankService = new MockBankService(),
): ToolRegistry {
  const registry = createDefaultToolRegistry(service);
  registry.register({
    name: "branch.hours.read",
    version: 1,
    operationClass: "read_only",
    inputSchema: z.object({
      branchId: z.string().min(1),
      date: z.string().date(),
    }),
    execute: async (input) =>
      service.getBranchHours(String(input.branchId), String(input.date)),
  });
  registry.register({
    name: "fee.schedule.read",
    version: 1,
    operationClass: "read_only",
    inputSchema: z.object({ productId: z.string().min(1) }),
    execute: async (input) => service.getFeeSchedule(String(input.productId)),
  });
  registry.register({
    name: "appointment.draft.create",
    version: 1,
    operationClass: "reversible_write",
    inputSchema: z.object({ customerId: z.string().min(1), date: z.string().date() }),
    execute: async () => {
      throw new Error("APPOINTMENT_DRAFT_EXECUTION_NOT_ENABLED");
    },
  });
  registry.register({
    name: "ticket.status.read",
    version: 1,
    operationClass: "read_only",
    inputSchema: z.object({ ticketId: z.string().min(1) }),
    execute: async (input) => service.getTicket(String(input.ticketId)),
  });
  registry.register({
    name: "account.opening.missing-docs.read",
    version: 1,
    operationClass: "read_only",
    inputSchema: z.object({ customerId: z.string().min(1) }),
    execute: async (input) => service.getMissingDocuments(String(input.customerId)),
  });
  registry.register({
    name: "customer.summary.read",
    version: 1,
    operationClass: "read_only",
    inputSchema: z.object({ customerId: z.string().min(1) }),
    execute: async (input) => service.getCustomerSummary(String(input.customerId)),
  });
  return registry;
}
