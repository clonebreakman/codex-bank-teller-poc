import { z } from "zod";

export const auditMetadataSchema = z.object({
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  synthetic: z.literal(true),
});

const identifier = z.string().min(1);
const currency = z.string().length(3).regex(/^[A-Z]{3}$/);
const minorAmount = z.number().int().nonnegative();

export const customerSchema = auditMetadataSchema.extend({
  customerId: identifier,
  displayName: z.string().min(1),
  status: z.enum(["active", "blocked"]),
});

export const accountSchema = auditMetadataSchema.extend({
  accountId: identifier,
  customerId: identifier,
  currency,
  balanceMinor: minorAmount,
  status: z.enum(["active", "frozen", "closed"]),
});

export const transactionSchema = auditMetadataSchema.extend({
  transactionId: identifier,
  accountId: identifier,
  type: z.enum(["credit", "debit"]),
  amountMinor: minorAmount,
  currency,
  status: z.enum(["pending", "posted", "failed", "reversed"]),
});

export const receiptSchema = auditMetadataSchema.extend({
  receiptId: identifier,
  transactionId: identifier,
  accountId: identifier,
  status: z.enum(["issued", "voided"]),
});

export const ticketSchema = auditMetadataSchema.extend({
  ticketId: identifier,
  customerId: identifier,
  status: z.enum(["open", "in_progress", "resolved", "closed"]),
  category: z.string().min(1),
});

export type AccountStatus = z.infer<typeof accountSchema>["status"];
export type SyntheticCustomer = z.infer<typeof customerSchema>;
export type SyntheticAccount = z.infer<typeof accountSchema>;
export type SyntheticTransaction = z.infer<typeof transactionSchema>;
export type SyntheticReceipt = z.infer<typeof receiptSchema>;
export type SyntheticTicket = z.infer<typeof ticketSchema>;

export interface SyntheticAccountInput {
  accountId: string;
  customerId: string;
  currency: string;
  balanceMinor: number;
}

export function createSyntheticAccount(
  input: SyntheticAccountInput,
): SyntheticAccount {
  if (!Number.isSafeInteger(input.balanceMinor) || input.balanceMinor < 0) {
    throw new Error("BALANCE_INVALID");
  }

  const timestamp = new Date().toISOString();
  return accountSchema.parse({
    ...input,
    status: "active",
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    synthetic: true,
  });
}
