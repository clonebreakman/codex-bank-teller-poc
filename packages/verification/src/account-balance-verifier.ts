import type {
  AccountBalance,
  MockBankService,
} from "@codex-bank-teller/mock-bank/service";

type BalanceClaim = Omit<Partial<AccountBalance>, "synthetic"> & {
  synthetic?: boolean;
};

export function verifyAccountBalance(
  service: MockBankService,
  input: {
    accountId: string;
    customerId: string;
    claimed: BalanceClaim;
  },
): { verified: boolean; verificationCode: string } {
  let actual: AccountBalance;
  try {
    actual = service.getAccountBalance(input.accountId, input.customerId);
  } catch (error) {
    if (error instanceof Error && error.message === "IDENTITY_MISMATCH") {
      return { verified: false, verificationCode: "IDENTITY_MISMATCH" };
    }
    if (error instanceof Error && error.message === "ACCOUNT_NOT_FOUND") {
      return { verified: false, verificationCode: "ACCOUNT_NOT_FOUND" };
    }
    return { verified: false, verificationCode: "BANK_STATE_UNAVAILABLE" };
  }

  if (input.claimed.synthetic !== true) {
    return { verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" };
  }
  if (
    input.claimed.accountId !== actual.accountId ||
    input.claimed.currency !== actual.currency ||
    input.claimed.balanceMinor !== actual.balanceMinor
  ) {
    return { verified: false, verificationCode: "BALANCE_MISMATCH" };
  }
  return { verified: true, verificationCode: "BALANCE_VERIFIED" };
}
