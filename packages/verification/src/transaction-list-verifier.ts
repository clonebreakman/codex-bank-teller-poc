import type { MockBankService } from "@codex-bank-teller/mock-bank/service";

export function verifyTransactionList(
  service: MockBankService,
  input: {
    accountId: string;
    customerId: string;
    limit: number;
    claimed: unknown[];
  },
): { verified: boolean; verificationCode: string } {
  let actual: unknown[];
  try {
    actual = service.listTransactions(
      input.accountId,
      input.limit,
      input.customerId,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "IDENTITY_MISMATCH") {
      return { verified: false, verificationCode: "IDENTITY_MISMATCH" };
    }
    return { verified: false, verificationCode: "TRANSACTIONS_UNAVAILABLE" };
  }

  if (input.claimed.length !== actual.length) {
    return { verified: false, verificationCode: "TRANSACTIONS_MISMATCH" };
  }
  const actualIds = actual.map((item) => (item as { transactionId?: string }).transactionId);
  const claimedIds = input.claimed.map(
    (item) => (item as { transactionId?: string }).transactionId,
  );
  if (JSON.stringify(actualIds) !== JSON.stringify(claimedIds)) {
    return { verified: false, verificationCode: "TRANSACTIONS_MISMATCH" };
  }
  if (input.claimed.some((item) => (item as { synthetic?: boolean }).synthetic !== true)) {
    return { verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" };
  }
  return { verified: true, verificationCode: "TRANSACTIONS_VERIFIED" };
}
