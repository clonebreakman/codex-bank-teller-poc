import { describe, expect, it } from "vitest";
import { createDefaultToolRegistry } from "./tool-registry.js";

describe("tool registry", () => {
  it("registers only the approved read-only tools", () => {
    const registry = createDefaultToolRegistry();

    expect(registry.list().map((tool) => tool.name)).toEqual([
      "account.balance.read",
      "account.transactions.read",
      "receipt.read",
    ]);
    expect(registry.get("account.balance.read")).toMatchObject({
      version: 1,
      operationClass: "read_only",
    });
  });

  it("rejects duplicate tools and unknown lookups stay empty", () => {
    const registry = createDefaultToolRegistry();
    const tool = registry.get("account.balance.read");

    expect(tool).toBeDefined();
    expect(() => registry.register(tool!)).toThrowError("TOOL_DUPLICATE");
    expect(registry.get("admin.transfer.execute")).toBeUndefined();
  });
});
