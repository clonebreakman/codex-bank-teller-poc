import { describe, expect, it } from "vitest";
import { MockBankService } from "@codex-bank-teller/mock-bank/service";
import { verifyAccountBalance } from "./account-balance-verifier.js";
import { verifyTransactionList } from "./transaction-list-verifier.js";
import { verifySecurityEvent } from "./security-event-verifier.js";
import {
  verifyBranchHours,
  verifyFeeSchedule,
  verifyReceipt,
  verifyCustomerSummary,
  verifyMissingDocuments,
  verifyTicketStatus,
} from "./read-only-verifiers.js";

describe("external state verification", () => {
  it("accepts a claim only when the Mock Bank state matches", () => {
    const service = new MockBankService({
      now: () => "2026-08-22T00:00:00.000Z",
    });
    const actual = service.getAccountBalance("ACC-1001");

    expect(
      verifyAccountBalance(service, {
        accountId: "ACC-1001",
        customerId: "CUST-1001",
        claimed: actual,
      }),
    ).toEqual({
      verified: true,
      verificationCode: "BALANCE_VERIFIED",
    });
  });

  it("rejects a model claim that differs from external state", () => {
    const service = new MockBankService();

    expect(
      verifyAccountBalance(service, {
        accountId: "ACC-1001",
        customerId: "CUST-1001",
        claimed: {
          accountId: "ACC-1001",
          currency: "USD",
          balanceMinor: 999999,
          asOf: "2026-08-22T00:00:00.000Z",
          synthetic: true,
        },
      }),
    ).toEqual({
      verified: false,
      verificationCode: "BALANCE_MISMATCH",
    });
  });

  it("rejects missing synthetic markers and identity mismatches", () => {
    const service = new MockBankService();

    expect(
      verifyAccountBalance(service, {
        accountId: "ACC-1001",
        customerId: "CUST-1001",
        claimed: {
          accountId: "ACC-1001",
          currency: "USD",
          balanceMinor: 125000,
          asOf: "2026-08-22T00:00:00.000Z",
          synthetic: false,
        },
      }),
    ).toMatchObject({ verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" });

    expect(
      verifyAccountBalance(service, {
        accountId: "ACC-1001",
        customerId: "CUST-9999",
        claimed: {},
      }),
    ).toMatchObject({ verified: false, verificationCode: "IDENTITY_MISMATCH" });
  });

  it("verifies the bounded transaction list against external state", () => {
    const service = new MockBankService();
    const transactions = service.listTransactions("ACC-1001", 10, "CUST-1001");

    expect(
      verifyTransactionList(service, {
        accountId: "ACC-1001",
        customerId: "CUST-1001",
        limit: 10,
        claimed: transactions,
      }),
    ).toEqual({ verified: true, verificationCode: "TRANSACTIONS_VERIFIED" });

    expect(
      verifyTransactionList(service, {
        accountId: "ACC-1001",
        customerId: "CUST-1001",
        limit: 10,
        claimed: transactions.slice(0, 9),
      }),
    ).toEqual({ verified: false, verificationCode: "TRANSACTIONS_MISMATCH" });
  });

  it("verifies that a security event contains a deny decision and reason", () => {
    expect(
      verifySecurityEvent({
        policyDecision: "deny",
        terminationReason: "EXTERNAL_DOMAIN_DENIED",
      }),
    ).toEqual({ verified: true, verificationCode: "SECURITY_EVENT_VERIFIED" });

    expect(
      verifySecurityEvent({
        policyDecision: "allow",
        terminationReason: undefined,
      }),
    ).toEqual({ verified: false, verificationCode: "SECURITY_EVENT_INVALID" });
  });

  it("verifies receipts, branch hours, and fee schedules", () => {
    const service = new MockBankService({
      now: () => "2026-08-22T00:00:00.000Z",
    });

    expect(
      verifyReceipt(service, { receiptId: "REC-1001", claimed: service.getReceipt("REC-1001") }),
    ).toEqual({ verified: true, verificationCode: "RECEIPT_VERIFIED" });
    expect(
      verifyBranchHours(service, {
        branchId: "BR-1001",
        date: "2026-08-22",
        claimed: service.getBranchHours("BR-1001", "2026-08-22"),
      }),
    ).toEqual({ verified: true, verificationCode: "BRANCH_HOURS_VERIFIED" });
    expect(
      verifyFeeSchedule(service, {
        productId: "CHECKING-USD",
        claimed: service.getFeeSchedule("CHECKING-USD"),
      }),
    ).toEqual({ verified: true, verificationCode: "FEE_SCHEDULE_VERIFIED" });
  });

  it("verifies ticket status, missing documents, and customer summary", () => {
    const service = new MockBankService();
    expect(
      verifyTicketStatus(service, {
        ticketId: "TKT-1001",
        claimed: service.getTicket("TKT-1001"),
      }),
    ).toEqual({ verified: true, verificationCode: "TICKET_STATUS_VERIFIED" });
    expect(
      verifyMissingDocuments(service, {
        customerId: "CUST-1001",
        claimed: service.getMissingDocuments("CUST-1001"),
      }),
    ).toEqual({ verified: true, verificationCode: "MISSING_DOCUMENTS_VERIFIED" });
    expect(
      verifyCustomerSummary(service, {
        customerId: "CUST-1001",
        claimed: service.getCustomerSummary("CUST-1001"),
      }),
    ).toEqual({ verified: true, verificationCode: "CUSTOMER_SUMMARY_VERIFIED" });
  });
});
