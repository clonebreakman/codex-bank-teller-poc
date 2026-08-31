import { describe, expect, it } from "vitest";
import {
  accountSchema,
  customerSchema,
  receiptSchema,
  ticketSchema,
  transactionSchema,
} from "./index.js";

const metadata = {
  version: 1,
  createdAt: "2026-08-22T00:00:00.000Z",
  updatedAt: "2026-08-22T00:00:00.000Z",
  synthetic: true,
} as const;

describe("synthetic banking domain schemas", () => {
  it("accepts all supported entities with audit metadata", () => {
    expect(
      customerSchema.parse({
        customerId: "CUST-1001",
        displayName: "Synthetic Customer 1001",
        status: "active",
        ...metadata,
      }),
    ).toMatchObject({ customerId: "CUST-1001", synthetic: true });

    expect(
      accountSchema.parse({
        accountId: "ACC-1001",
        customerId: "CUST-1001",
        currency: "USD",
        balanceMinor: 125000,
        status: "active",
        ...metadata,
      }),
    ).toMatchObject({ accountId: "ACC-1001", synthetic: true });

    expect(
      transactionSchema.parse({
        transactionId: "TX-1001",
        accountId: "ACC-1001",
        type: "credit",
        amountMinor: 1000,
        currency: "USD",
        status: "posted",
        ...metadata,
      }),
    ).toMatchObject({ transactionId: "TX-1001", synthetic: true });

    expect(
      receiptSchema.parse({
        receiptId: "REC-1001",
        transactionId: "TX-1001",
        accountId: "ACC-1001",
        status: "issued",
        ...metadata,
      }),
    ).toMatchObject({ receiptId: "REC-1001", synthetic: true });

    expect(
      ticketSchema.parse({
        ticketId: "TKT-1001",
        customerId: "CUST-1001",
        status: "open",
        category: "account_support",
        ...metadata,
      }),
    ).toMatchObject({ ticketId: "TKT-1001", synthetic: true });
  });

  it("rejects non-synthetic data and fractional minor-unit amounts", () => {
    expect(() =>
      accountSchema.parse({
        accountId: "ACC-1001",
        customerId: "CUST-1001",
        currency: "USD",
        balanceMinor: 12.5,
        status: "active",
        ...metadata,
        synthetic: false,
      }),
    ).toThrow();

    expect(() =>
      transactionSchema.parse({
        transactionId: "TX-1001",
        accountId: "ACC-1001",
        type: "credit",
        amountMinor: 10.5,
        currency: "USD",
        status: "posted",
        ...metadata,
      }),
    ).toThrow();
  });
});
