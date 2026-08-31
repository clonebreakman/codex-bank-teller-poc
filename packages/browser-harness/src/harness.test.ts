import { describe, expect, it } from "vitest";
import { InMemoryBrowserHarness } from "./harness.js";

describe("isolated browser harness", () => {
  it("requires a fresh observation before each action", async () => {
    const harness = new InMemoryBrowserHarness([
      "http://127.0.0.1:4100",
    ]);
    const observation = await harness.open("http://127.0.0.1:4100/v1/health");

    await harness.click(observation, { x: 10, y: 10 });
    await expect(
      harness.click(observation, { x: 10, y: 10 }),
    ).rejects.toThrowError("OBSERVATION_STALE");
  });

  it("rejects external navigation and unapproved actions", async () => {
    const harness = new InMemoryBrowserHarness([
      "http://127.0.0.1:4100",
    ]);

    await expect(
      harness.open("https://real-bank.example/login"),
    ).rejects.toThrowError("EXTERNAL_DOMAIN_DENIED");

    const observation = await harness.open("http://127.0.0.1:4100");
    await expect(harness.upload(observation, "fixture.txt")).rejects.toThrowError(
      "ACTION_NOT_ALLOWED",
    );
  });

  it("records action summaries without sensitive text", async () => {
    const harness = new InMemoryBrowserHarness([
      "http://127.0.0.1:4100",
    ]);
    const observation = await harness.open("http://127.0.0.1:4100");
    const next = await harness.type(observation, "123456");

    expect(next.actions[0]).toMatchObject({ type: "type", text: "[REDACTED]" });
  });
});
