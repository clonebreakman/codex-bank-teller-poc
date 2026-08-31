import { describe, expect, it } from "vitest";
import { redactSensitive } from "./redaction.js";

describe("tool result redaction", () => {
  it("removes credential-like and identifying fields from logs", () => {
    const result = redactSensitive({
      accountId: "ACC-1001",
      customerId: "CUST-1001",
      displayName: "Synthetic Customer 1001",
      otp: "123456",
      nested: { pin: "0000" },
    });

    expect(result.value).toEqual({
      accountId: "AC***01",
      customerId: "CU***01",
      displayName: "[REDACTED]",
      otp: "[REDACTED]",
      nested: { pin: "[REDACTED]" },
    });
    expect(result.redactedFields).toEqual([
      "accountId",
      "customerId",
      "displayName",
      "nested.pin",
      "otp",
    ]);
  });
});
