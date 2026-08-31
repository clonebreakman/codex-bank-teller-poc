import { describe, expect, it } from "vitest";
import { MockBankService } from "./service.js";

describe("MockBankService", () => {
  it("returns a deterministic synthetic balance for a known account", () => {
    const service = new MockBankService({
      now: () => "2026-08-22T00:00:00.000Z",
    });

    expect(service.getAccountBalance("ACC-1001")).toEqual({
      accountId: "ACC-1001",
      currency: "USD",
      balanceMinor: 125000,
      asOf: "2026-08-22T00:00:00.000Z",
      synthetic: true,
    });
  });

  it("does not guess when an account is unknown", () => {
    const service = new MockBankService();

    expect(() => service.getAccountBalance("ACC-9999")).toThrowError(
      "ACCOUNT_NOT_FOUND",
    );
  });

  it("returns a bounded deterministic transaction list", () => {
    const service = new MockBankService({
      now: () => "2026-08-22T00:00:00.000Z",
    });

    const result = service.listTransactions("ACC-1001", 10);

    expect(result).toHaveLength(10);
    expect(result[0]).toMatchObject({
      transactionId: "TX-1001",
      accountId: "ACC-1001",
      amountMinor: 1000,
      currency: "USD",
      synthetic: true,
    });
    expect(service.listTransactions("ACC-1001", 20)).toHaveLength(12);
  });

  it("returns synthetic receipts and tickets", () => {
    const service = new MockBankService();

    expect(service.getReceipt("REC-1001")).toMatchObject({
      receiptId: "REC-1001",
      accountId: "ACC-1001",
      synthetic: true,
    });
    expect(service.getTicket("TKT-1001")).toMatchObject({
      ticketId: "TKT-1001",
      customerId: "CUST-1001",
      synthetic: true,
    });
  });

  it("rejects a mismatched synthetic customer identity", () => {
    const service = new MockBankService();

    expect(() =>
      service.getAccountBalance("ACC-1001", "CUST-9999"),
    ).toThrowError("IDENTITY_MISMATCH");
  });
});
