import { randomUUID } from "node:crypto";
import {
  assertAllowedAction,
  assertAllowedOrigin,
  createBrowserPolicy,
  type BrowserPolicy,
} from "./allowlist.js";

interface Observation {
  observationId: string;
  url: string;
  actions: Array<Record<string, unknown>>;
}

export class InMemoryBrowserHarness {
  private readonly policy: BrowserPolicy;
  private currentObservationId: string | undefined;

  public constructor(allowedOrigins: string[]) {
    this.policy = createBrowserPolicy(allowedOrigins);
  }

  public async open(url: string): Promise<Observation> {
    assertAllowedAction("open");
    assertAllowedOrigin(this.policy, url);
    return this.observe(url, []);
  }

  public async click(
    observation: Observation,
    input: { x: number; y: number },
  ): Promise<Observation> {
    this.consume(observation);
    assertAllowedAction("click");
    return this.observe(observation.url, [
      { type: "click", x: input.x, y: input.y },
    ]);
  }

  public async type(
    observation: Observation,
    text: string,
  ): Promise<Observation> {
    void text;
    this.consume(observation);
    assertAllowedAction("type");
    return this.observe(observation.url, [
      { type: "type", text: "[REDACTED]" },
    ]);
  }

  public async upload(
    observation: Observation,
    fileName: string,
  ): Promise<never> {
    void observation;
    void fileName;
    assertAllowedAction("upload");
    throw new Error("ACTION_NOT_ALLOWED");
  }

  private observe(url: string, actions: Array<Record<string, unknown>>): Observation {
    const observation = {
      observationId: `OBS-${randomUUID()}`,
      url,
      actions,
    };
    this.currentObservationId = observation.observationId;
    return observation;
  }

  private consume(observation: Observation): void {
    if (observation.observationId !== this.currentObservationId) {
      throw new Error("OBSERVATION_STALE");
    }
    this.currentObservationId = undefined;
  }
}
