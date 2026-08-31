import { describe, expect, it } from "vitest";
import {
  assertAllowedAction,
  assertAllowedOrigin,
  createBrowserPolicy,
} from "@codex-bank-teller/browser-harness";

describe("browser isolation security boundary", () => {
  it("blocks external origins", () => {
    const policy = createBrowserPolicy(["http://127.0.0.1:4100"]);
    expect(() =>
      assertAllowedOrigin(policy, "https://example.com/instruction"),
    ).toThrowError("EXTERNAL_DOMAIN_DENIED");
  });

  it("blocks unregistered UI actions", () => {
    expect(() => assertAllowedAction("upload")).toThrowError(
      "ACTION_NOT_ALLOWED",
    );
  });
});
