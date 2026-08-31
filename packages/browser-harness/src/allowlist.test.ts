import { describe, expect, it } from "vitest";
import {
  assertAllowedAction,
  assertAllowedOrigin,
  createBrowserPolicy,
} from "./allowlist.js";

describe("isolated browser allowlist", () => {
  const policy = createBrowserPolicy([
    "http://127.0.0.1:4100",
    "http://localhost:4100",
  ]);

  it("allows only the configured local synthetic bank origins", () => {
    expect(() => assertAllowedOrigin(policy, "http://127.0.0.1:4100/v1/health")).not.toThrow();
    expect(() => assertAllowedOrigin(policy, "https://real-bank.example")).toThrowError(
      "EXTERNAL_DOMAIN_DENIED",
    );
    expect(() => assertAllowedOrigin(policy, "javascript:alert(1)")).toThrowError(
      "EXTERNAL_DOMAIN_DENIED",
    );
  });

  it("allows observation and basic interaction only", () => {
    for (const action of ["open", "snapshot", "click", "type", "scroll", "screenshot", "close"] as const) {
      expect(() => assertAllowedAction(action)).not.toThrow();
    }
    expect(() => assertAllowedAction("upload")).toThrowError("ACTION_NOT_ALLOWED");
    expect(() => assertAllowedAction("download")).toThrowError("ACTION_NOT_ALLOWED");
  });
});
