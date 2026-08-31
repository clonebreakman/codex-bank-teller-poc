import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { FileAuditLog } from "@codex-bank-teller/audit-log";
import {
  startOperatorConsoleServer,
  type OperatorConsoleServerHandle,
} from "../../apps/operator-console/src/server.js";
import type { ReviewCase } from "../../apps/operator-console/src/review/index.js";

export interface OperatorConsoleBrowserFixture {
  baseUrl: string;
  review: ReviewCase;
  auditLogPath: string;
  browser: Browser;
  close(): Promise<void>;
}

export async function createOperatorConsoleBrowserFixture(input: {
  review: ReviewCase;
}): Promise<OperatorConsoleBrowserFixture> {
  const directory = await mkdtemp(join(tmpdir(), "codex-bank-console-browser-"));
  const auditLogPath = join(directory, "events.jsonl");
  const auditLog = new FileAuditLog(auditLogPath);
  let server: OperatorConsoleServerHandle | undefined;
  let browser: Browser | undefined;

  try {
    server = await startOperatorConsoleServer({
      cases: [input.review],
      auditLog,
    });
    browser = await chromium.launch({ headless: true });
    return {
      baseUrl: server.url,
      review: input.review,
      auditLogPath,
      browser,
      close: async () => {
        await browser?.close();
        await server?.close();
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await browser?.close();
    await server?.close();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
