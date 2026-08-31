import { describe, expect, it } from "vitest";
import { createSyntheticAccount } from "./index.js";

describe("synthetic account model", () => {
  it("creates an explicitly synthetic account", () => {
    expect(
      createSyntheticAccount({
        accountId: "ACC-1001",
        customerId: "CUS-1001",
        currency: "USD",
        balanceMinor: 125000,
      }),
    ).toEqual({
      accountId: "ACC-1001",
      customerId: "CUS-1001",
      currency: "USD",
      balanceMinor: 125000,
      status: "active",
      synthetic: true,
      version: 1,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("rejects a negative account balance", () => {
    expect(() =>
      createSyntheticAccount({
        accountId: "ACC-1002",
        customerId: "CUS-1002",
        currency: "CNY",
        balanceMinor: -1,
      }),
    ).toThrowError("BALANCE_INVALID");
  });
});
