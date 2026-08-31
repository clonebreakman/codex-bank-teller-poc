export type BrowserAction =
  | "open"
  | "snapshot"
  | "click"
  | "type"
  | "scroll"
  | "screenshot"
  | "close";

export interface BrowserPolicy {
  allowedOrigins: readonly string[];
  allowedActions: readonly BrowserAction[];
}

export function createBrowserPolicy(allowedOrigins: string[]): BrowserPolicy {
  const origins = allowedOrigins.map((origin) => new URL(origin).origin);
  if (origins.some((origin) => !origin.startsWith("http://localhost") && !origin.startsWith("http://127.0.0.1"))) {
    throw new Error("LOCAL_ORIGIN_REQUIRED");
  }
  return {
    allowedOrigins: [...new Set(origins)],
    allowedActions: [
      "open",
      "snapshot",
      "click",
      "type",
      "scroll",
      "screenshot",
      "close",
    ],
  };
}

export function assertAllowedOrigin(policy: BrowserPolicy, target: string): void {
  let origin: string;
  try {
    origin = new URL(target).origin;
  } catch {
    throw new Error("EXTERNAL_DOMAIN_DENIED");
  }
  if (!policy.allowedOrigins.includes(origin)) {
    throw new Error("EXTERNAL_DOMAIN_DENIED");
  }
}

export function assertAllowedAction(
  action: string,
): asserts action is BrowserAction {
  const allowed = new Set<BrowserAction>([
    "open",
    "snapshot",
    "click",
    "type",
    "scroll",
    "screenshot",
    "close",
  ]);
  if (!allowed.has(action as BrowserAction)) {
    throw new Error("ACTION_NOT_ALLOWED");
  }
}

export function detectPromptInjection(text: string):
  | { detected: true; reasonCode: "PROMPT_INJECTION_DETECTED" }
  | { detected: false } {
  const patterns = [
    /ignore\s+(all\s+)?previous\s+instructions/i,
    /忽略(之前|先前)的指令/,
    /system\s+message\s*:/i,
    /upload\s+.*(file|document)/i,
    /上传.*(文件|资料)/,
  ];
  return patterns.some((pattern) => pattern.test(text))
    ? { detected: true, reasonCode: "PROMPT_INJECTION_DETECTED" }
    : { detected: false };
}
