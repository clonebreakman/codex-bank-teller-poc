import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { FileAuditLog } from "@codex-bank-teller/audit-log";
import {
  recordReviewAction,
  type ReviewAction,
  type ReviewCase,
} from "./review/index.js";
import { renderReviewPage } from "./ui/review-page.js";

const MAX_BODY_BYTES = 16 * 1024;
const SYNTHETIC_ACTOR_PATTERN = /^TELLER-[A-Z0-9-]+$/;
const ACTIONS = new Set<ReviewAction["type"]>([
  "confirm",
  "modify",
  "handoff",
  "reject",
]);
const ALLOWED_ACTION_FIELDS = new Set(["action", "actorId", "note"]);

type RunLocks = Map<string, Promise<void>>;

export interface OperatorConsoleServerOptions {
  cases: readonly ReviewCase[];
  auditLog: FileAuditLog;
  port?: number;
}

export interface OperatorConsoleServerHandle {
  readonly url: string;
  close(): Promise<void>;
}

export async function startOperatorConsoleServer(
  options: OperatorConsoleServerOptions,
): Promise<OperatorConsoleServerHandle> {
  if (options.cases.some((review) => review.synthetic !== true)) {
    throw new Error("SYNTHETIC_ONLY_REQUIRED");
  }

  const reviews = new Map(options.cases.map((review) => [review.runId, review]));
  const runLocks: RunLocks = new Map();
  const host = "127.0.0.1";
  const port = options.port ?? 0;
  const server = createServer((request, response) => {
    void handleRequest(request, response, reviews, runLocks, options.auditLog);
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    throw new Error("SERVER_ADDRESS_UNAVAILABLE");
  }
  const bound = address as AddressInfo;

  return {
    url: `http://${host}:${bound.port}`,
    close: () => closeServer(server),
  };
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  reviews: Map<string, ReviewCase>,
  runLocks: RunLocks,
  auditLog: FileAuditLog,
): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = requestUrl.pathname;

    if (request.method === "GET" && path === "/health") {
      writeJson(response, 200, { ok: true, syntheticOnly: true });
      return;
    }

    if (request.method === "GET") {
      const runId = extractRunId(path, "review");
      if (runId !== undefined) {
        const review = reviews.get(runId);
        if (!review) {
          writeJson(response, 404, { ok: false, reason: "REVIEW_NOT_FOUND" });
          return;
        }
        const html = renderReviewPage(review, {
          actionEndpoint: `/review/${encodeURIComponent(runId)}/action`,
          actorId: "TELLER-1",
        });
        writeHtml(response, 200, html);
        return;
      }
    }

    if (request.method === "POST") {
      const runId = extractActionRunId(path);
      if (runId !== undefined) {
        if (!reviews.has(runId)) {
          writeJson(response, 404, { ok: false, reason: "REVIEW_NOT_FOUND" });
          return;
        }

        const bodyResult = await readActionBody(request);
        if (!bodyResult.ok) {
          writeJson(response, bodyResult.status, {
            ok: false,
            reason: "INVALID_ACTION_REQUEST",
          });
          return;
        }
        const input = validateActionBody(bodyResult.value);
        if (!input.ok) {
          writeJson(response, 400, { ok: false, reason: input.reason });
          return;
        }

        const result = await withRunLock(runLocks, runId, async () => {
          const review = reviews.get(runId);
          if (!review) {
            return { ok: false as const, reason: "REVIEW_NOT_FOUND" as const };
          }
          const actionResult = await recordReviewAction(auditLog, review, input.action);
          if (actionResult.ok) {
            reviews.set(runId, actionResult.review);
          }
          return actionResult;
        });
        if (result.ok === false && result.reason === "REVIEW_NOT_FOUND") {
          writeJson(response, 404, result);
          return;
        }
        writeJson(response, 200, result);
        return;
      }
    }

    writeJson(response, 404, { ok: false, reason: "NOT_FOUND" });
  } catch {
    if (!response.headersSent) {
      writeJson(response, 500, { ok: false, reason: "INTERNAL_ERROR" });
    } else if (!response.writableEnded) {
      response.end();
    }
  }
}

async function withRunLock<T>(
  locks: RunLocks,
  runId: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(runId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(runId, current);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (locks.get(runId) === current) {
      locks.delete(runId);
    }
  }
}

function extractRunId(path: string, resource: string): string | undefined {
  const match = path.match(new RegExp(`^/${resource}/([^/]+)$`));
  return match ? decodeSegment(match[1]) : undefined;
}

function extractActionRunId(path: string): string | undefined {
  const match = path.match(/^\/review\/([^/]+)\/action$/);
  return match ? decodeSegment(match[1]) : undefined;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return "";
  }
}

async function readActionBody(
  request: IncomingMessage,
): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 }
> {
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    request.resume();
    return { ok: false, status: 400 };
  }

  const contentLength = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    request.resume();
    return { ok: false, status: 413 };
  }

  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) {
      request.resume();
      return { ok: false, status: 413 };
    }
    chunks.push(buffer);
  }

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

function validateActionBody(
  value: unknown,
):
  | { ok: true; action: ReviewAction }
  | {
      ok: false;
      reason: "INVALID_ACTION_REQUEST" | "SYNTHETIC_ACTOR_REQUIRED";
    } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "INVALID_ACTION_REQUEST" };
  }

  const candidate = value as Record<string, unknown>;
  if ([...Object.keys(candidate)].some((key) => !ALLOWED_ACTION_FIELDS.has(key))) {
    return { ok: false, reason: "INVALID_ACTION_REQUEST" };
  }
  if (typeof candidate.action !== "string" || !ACTIONS.has(candidate.action as ReviewAction["type"])) {
    return { ok: false, reason: "INVALID_ACTION_REQUEST" };
  }
  if (typeof candidate.actorId !== "string" || !SYNTHETIC_ACTOR_PATTERN.test(candidate.actorId)) {
    return { ok: false, reason: "SYNTHETIC_ACTOR_REQUIRED" };
  }
  if (candidate.note !== undefined && typeof candidate.note !== "string") {
    return { ok: false, reason: "INVALID_ACTION_REQUEST" };
  }

  const action = candidate.action as ReviewAction["type"];
  if (action === "modify") {
    return {
      ok: true,
      action: {
        type: "modify",
        actorId: candidate.actorId,
        note: typeof candidate.note === "string" ? candidate.note : "",
      },
    };
  }
  return {
    ok: true,
    action: { type: action, actorId: candidate.actorId },
  };
}

function writeHtml(response: ServerResponse, status: number, html: string): void {
  response.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
