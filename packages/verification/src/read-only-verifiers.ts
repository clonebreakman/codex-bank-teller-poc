import type { MockBankService } from "@codex-bank-teller/mock-bank/service";

export function verifyReceipt(
  service: MockBankService,
  input: { receiptId: string; claimed: unknown },
): { verified: boolean; verificationCode: string } {
  try {
    const actual = service.getReceipt(input.receiptId);
    const claimed = input.claimed as { receiptId?: string; synthetic?: boolean };
    if (claimed.synthetic !== true) {
      return { verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" };
    }
    if (claimed.receiptId !== actual.receiptId) {
      return { verified: false, verificationCode: "RECEIPT_MISMATCH" };
    }
    return { verified: true, verificationCode: "RECEIPT_VERIFIED" };
  } catch {
    return { verified: false, verificationCode: "RECEIPT_NOT_FOUND" };
  }
}

export function verifyBranchHours(
  service: MockBankService,
  input: { branchId: string; date: string; claimed: unknown },
): { verified: boolean; verificationCode: string } {
  try {
    const actual = service.getBranchHours(input.branchId, input.date);
    const claimed = input.claimed as {
      branchId?: string;
      date?: string;
      open?: string;
      close?: string;
      synthetic?: boolean;
    };
    if (claimed.synthetic !== true) {
      return { verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" };
    }
    if (
      claimed.branchId !== actual.branchId ||
      claimed.date !== actual.date ||
      claimed.open !== actual.open ||
      claimed.close !== actual.close
    ) {
      return { verified: false, verificationCode: "BRANCH_HOURS_MISMATCH" };
    }
    return { verified: true, verificationCode: "BRANCH_HOURS_VERIFIED" };
  } catch {
    return { verified: false, verificationCode: "BRANCH_HOURS_UNAVAILABLE" };
  }
}

export function verifyFeeSchedule(
  service: MockBankService,
  input: { productId: string; claimed: unknown },
): { verified: boolean; verificationCode: string } {
  try {
    const actual = service.getFeeSchedule(input.productId);
    const claimed = input.claimed as {
      productId?: string;
      currency?: string;
      monthlyFeeMinor?: number;
      version?: number;
      synthetic?: boolean;
    };
    if (claimed.synthetic !== true) {
      return { verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" };
    }
    if (
      claimed.productId !== actual.productId ||
      claimed.currency !== actual.currency ||
      claimed.monthlyFeeMinor !== actual.monthlyFeeMinor ||
      claimed.version !== actual.version
    ) {
      return { verified: false, verificationCode: "FEE_SCHEDULE_MISMATCH" };
    }
    return { verified: true, verificationCode: "FEE_SCHEDULE_VERIFIED" };
  } catch {
    return { verified: false, verificationCode: "FEE_SCHEDULE_UNAVAILABLE" };
  }
}

export function verifyAppointmentDraftBoundary(input: {
  decision: string;
  executed: boolean;
}): { verified: boolean; verificationCode: string } {
  if (input.decision === "confirm" && input.executed === false) {
    return {
      verified: true,
      verificationCode: "APPOINTMENT_CONFIRMATION_REQUIRED",
    };
  }
  return { verified: false, verificationCode: "APPOINTMENT_BOUNDARY_VIOLATION" };
}

export function verifyTicketStatus(
  service: MockBankService,
  input: { ticketId: string; claimed: unknown },
): { verified: boolean; verificationCode: string } {
  try {
    const actual = service.getTicket(input.ticketId);
    const claimed = input.claimed as { ticketId?: string; synthetic?: boolean; status?: string };
    if (claimed.synthetic !== true) {
      return { verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" };
    }
    if (claimed.ticketId !== actual.ticketId || claimed.status !== actual.status) {
      return { verified: false, verificationCode: "TICKET_STATUS_MISMATCH" };
    }
    return { verified: true, verificationCode: "TICKET_STATUS_VERIFIED" };
  } catch {
    return { verified: false, verificationCode: "TICKET_NOT_FOUND" };
  }
}

export function verifyMissingDocuments(
  service: MockBankService,
  input: { customerId: string; claimed: unknown },
): { verified: boolean; verificationCode: string } {
  try {
    const actual = service.getMissingDocuments(input.customerId);
    const claimed = input.claimed as {
      customerId?: string;
      missingDocuments?: string[];
      synthetic?: boolean;
    };
    if (claimed.synthetic !== true) {
      return { verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" };
    }
    if (
      claimed.customerId !== actual.customerId ||
      JSON.stringify(claimed.missingDocuments) !== JSON.stringify(actual.missingDocuments)
    ) {
      return { verified: false, verificationCode: "MISSING_DOCUMENTS_MISMATCH" };
    }
    return { verified: true, verificationCode: "MISSING_DOCUMENTS_VERIFIED" };
  } catch {
    return { verified: false, verificationCode: "CUSTOMER_NOT_FOUND" };
  }
}

export function verifyCustomerSummary(
  service: MockBankService,
  input: { customerId: string; claimed: unknown },
): { verified: boolean; verificationCode: string } {
  try {
    const actual = service.getCustomerSummary(input.customerId);
    const claimed = input.claimed as {
      customerId?: string;
      accountCount?: number;
      openTicketCount?: number;
      synthetic?: boolean;
    };
    if (claimed.synthetic !== true) {
      return { verified: false, verificationCode: "SYNTHETIC_FLAG_MISSING" };
    }
    if (
      claimed.customerId !== actual.customerId ||
      claimed.accountCount !== actual.accountCount ||
      claimed.openTicketCount !== actual.openTicketCount
    ) {
      return { verified: false, verificationCode: "CUSTOMER_SUMMARY_MISMATCH" };
    }
    return { verified: true, verificationCode: "CUSTOMER_SUMMARY_VERIFIED" };
  } catch {
    return { verified: false, verificationCode: "CUSTOMER_NOT_FOUND" };
  }
}
