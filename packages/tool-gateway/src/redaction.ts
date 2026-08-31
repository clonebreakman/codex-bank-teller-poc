const sensitiveKey = /password|passcode|otp|pin|cvv|secret|token/i;

export interface RedactionResult {
  value: unknown;
  redactedFields: string[];
}

export function redactSensitive(value: unknown): RedactionResult {
  const redactedFields: string[] = [];

  const redact = (current: unknown, path: string): unknown => {
    if (Array.isArray(current)) {
      return current.map((item, index) => redact(item, `${path}[${index}]`));
    }
    if (current === null || typeof current !== "object") {
      return current;
    }

    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(current)) {
      const childPath = path ? `${path}.${key}` : key;
      if (sensitiveKey.test(key) || key === "displayName") {
        result[key] = "[REDACTED]";
        redactedFields.push(childPath);
      } else if (key === "accountId" || key === "customerId") {
        result[key] = maskIdentifier(String(child));
        redactedFields.push(childPath);
      } else {
        result[key] = redact(child, childPath);
      }
    }
    return result;
  };

  return {
    value: redact(value, ""),
    redactedFields: redactedFields.sort(),
  };
}

function maskIdentifier(identifier: string): string {
  if (identifier.length <= 4) {
    return "[REDACTED]";
  }
  return `${identifier.slice(0, 2)}***${identifier.slice(-2)}`;
}
