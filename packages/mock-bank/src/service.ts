import {
  accountSchema,
  createSyntheticAccount,
  receiptSchema,
  ticketSchema,
  transactionSchema,
  type SyntheticAccount,
  type SyntheticReceipt,
  type SyntheticTicket,
  type SyntheticTransaction,
} from "@codex-bank-teller/domain-model";

export interface AccountBalance {
  accountId: string;
  currency: string;
  balanceMinor: number;
  asOf: string;
  synthetic: true;
}

export interface MockBankServiceOptions {
  now?: () => string;
}

export class MockBankService {
  private readonly accounts = new Map<string, SyntheticAccount>([
    [
      "ACC-1001",
      createSyntheticAccount({
        accountId: "ACC-1001",
        customerId: "CUST-1001",
        currency: "USD",
        balanceMinor: 125000,
      }),
    ],
  ]);

  private readonly transactions: SyntheticTransaction[];
  private readonly receipts = new Map<string, SyntheticReceipt>();
  private readonly tickets = new Map<string, SyntheticTicket>();
  private readonly now: () => string;

  public constructor(options: MockBankServiceOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.transactions = Array.from({ length: 12 }, (_, index) =>
      transactionSchema.parse({
        transactionId: `TX-${String(index + 1001)}`,
        accountId: "ACC-1001",
        type: index % 2 === 0 ? "credit" : "debit",
        amountMinor: (index + 1) * 1000,
        currency: "USD",
        status: "posted",
        version: 1,
        createdAt: this.now(),
        updatedAt: this.now(),
        synthetic: true,
      }),
    );

    this.receipts.set(
      "REC-1001",
      receiptSchema.parse({
        receiptId: "REC-1001",
        transactionId: "TX-1001",
        accountId: "ACC-1001",
        status: "issued",
        version: 1,
        createdAt: this.now(),
        updatedAt: this.now(),
        synthetic: true,
      }),
    );
    this.receipts.set(
      "REC-1002",
      receiptSchema.parse({
        receiptId: "REC-1002",
        transactionId: "TX-1002",
        accountId: "ACC-1001",
        status: "issued",
        version: 1,
        createdAt: this.now(),
        updatedAt: this.now(),
        synthetic: true,
      }),
    );

    this.tickets.set(
      "TKT-1001",
      ticketSchema.parse({
        ticketId: "TKT-1001",
        customerId: "CUST-1001",
        status: "open",
        category: "account_support",
        version: 1,
        createdAt: this.now(),
        updatedAt: this.now(),
        synthetic: true,
      }),
    );
  }

  public getAccountBalance(
    accountId: string,
    customerId?: string,
  ): AccountBalance {
    const account = this.getAccount(accountId);
    this.assertOwnership(account, customerId);

    return {
      accountId: account.accountId,
      currency: account.currency,
      balanceMinor: account.balanceMinor,
      asOf: this.now(),
      synthetic: true,
    };
  }

  public listTransactions(
    accountId: string,
    limit = 10,
    customerId?: string,
  ): SyntheticTransaction[] {
    const account = this.getAccount(accountId);
    this.assertOwnership(account, customerId);
    const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    return this.transactions
      .filter((transaction) => transaction.accountId === accountId)
      .slice(0, boundedLimit);
  }

  public getReceipt(receiptId: string): SyntheticReceipt {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) {
      throw new Error("RECEIPT_NOT_FOUND");
    }
    return receipt;
  }

  public getTicket(ticketId: string): SyntheticTicket {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) {
      throw new Error("TICKET_NOT_FOUND");
    }
    return ticket;
  }

  public getBranchHours(branchId: string, date: string): {
    branchId: string;
    date: string;
    open: string;
    close: string;
    closed: boolean;
    synthetic: true;
  } {
    if (branchId !== "BR-1001") {
      throw new Error("BRANCH_NOT_FOUND");
    }
    return {
      branchId,
      date,
      open: "09:00",
      close: "17:00",
      closed: false,
      synthetic: true,
    };
  }

  public getFeeSchedule(productId: string): {
    productId: string;
    currency: string;
    monthlyFeeMinor: number;
    version: 1;
    asOf: string;
    synthetic: true;
  } {
    if (productId !== "CHECKING-USD") {
      throw new Error("FEE_SCHEDULE_NOT_FOUND");
    }
    return {
      productId,
      currency: "USD",
      monthlyFeeMinor: 500,
      version: 1,
      asOf: this.now(),
      synthetic: true,
    };
  }

  public getMissingDocuments(customerId: string): {
    customerId: string;
    missingDocuments: string[];
    synthetic: true;
  } {
    if (customerId !== "CUST-1001") {
      throw new Error("CUSTOMER_NOT_FOUND");
    }
    return { customerId, missingDocuments: ["proof_of_address"], synthetic: true };
  }

  public getCustomerSummary(customerId: string): {
    customerId: string;
    accountCount: number;
    openTicketCount: number;
    synthetic: true;
  } {
    if (customerId !== "CUST-1001") {
      throw new Error("CUSTOMER_NOT_FOUND");
    }
    return { customerId, accountCount: 1, openTicketCount: 1, synthetic: true };
  }

  private getAccount(accountId: string): SyntheticAccount {
    const account = this.accounts.get(accountId);
    if (!account) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }
    return accountSchema.parse(account);
  }

  private assertOwnership(account: SyntheticAccount, customerId?: string): void {
    if (customerId !== undefined && customerId !== account.customerId) {
      throw new Error("IDENTITY_MISMATCH");
    }
  }
}
