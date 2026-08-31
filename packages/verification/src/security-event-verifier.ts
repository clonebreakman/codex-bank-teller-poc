export function verifySecurityEvent(input: {
  policyDecision: string;
  terminationReason?: string;
}): { verified: boolean; verificationCode: string } {
  if (
    input.policyDecision === "deny" &&
    typeof input.terminationReason === "string" &&
    input.terminationReason.length > 0
  ) {
    return { verified: true, verificationCode: "SECURITY_EVENT_VERIFIED" };
  }
  return { verified: false, verificationCode: "SECURITY_EVENT_INVALID" };
}
