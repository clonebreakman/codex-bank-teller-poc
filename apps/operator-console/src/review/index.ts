import { createHash } from "node:crypto";
import type { FileAuditLog } from "@codex-bank-teller/audit-log";

export type ReviewStatus =
  | "pending"
  | "confirmed"
  | "modified"
  | "handed_off"
  | "rejected";

export interface ReviewCitation {
  documentId: string;
  version: string;
  excerpt: string;
}

export interface ReviewCaseInput {
  runId: string;
  synthetic: true;
  customerContext: string;
  suggestedAction: string;
  riskLevel: "green" | "yellow" | "red";
  policyDecision: "allow" | "confirm" | "handoff" | "deny";
  verificationStatus: "verified" | "unverified";
  citations: readonly ReviewCitation[];
  auditEventIds: readonly string[];
}

export interface ReviewCase extends ReviewCaseInput {
  status: ReviewStatus;
  executed: false;
  modificationNote?: string;
}

export type ReviewAction =
  | { type: "confirm"; actorId: string }
  | { type: "modify"; actorId: string; note: string }
  | { type: "handoff"; actorId: string }
  | { type: "reject"; actorId: string };

export interface ReviewAuditEvent {
  action: ReviewAction["type"];
  actorId: string;
  runId: string;
  result: "accepted" | "rejected";
  note?: string;
}

export type ReviewActionResult =
  | {
      ok: true;
      review: ReviewCase;
      auditEvent: ReviewAuditEvent;
    }
  | {
      ok: false;
      reason:
        | "REVIEW_NOT_READY"
        | "REVIEW_TERMINAL"
        | "REVIEW_DUPLICATE_ACTION"
        | "MODIFICATION_NOTE_REQUIRED";
      auditEvent: ReviewAuditEvent;
    };

export function createReviewCase(input: ReviewCaseInput): ReviewCase {
  return {
    ...input,
    citations: [...input.citations],
    auditEventIds: [...input.auditEventIds],
    status: "pending",
    executed: false,
  };
}

export function reviewAction(
  review: ReviewCase,
  action: ReviewAction,
): ReviewActionResult {
  if (["handed_off", "rejected"].includes(review.status)) {
    return rejected(review, action, "REVIEW_TERMINAL");
  }

  if (review.status === "confirmed" && action.type === "confirm") {
    return rejected(review, action, "REVIEW_DUPLICATE_ACTION");
  }

  if (action.type === "confirm") {
    if (review.policyDecision !== "allow" || review.verificationStatus !== "verified") {
      return rejected(review, action, "REVIEW_NOT_READY");
    }
    return accepted(review, action, { status: "confirmed" });
  }

  if (action.type === "modify") {
    if (action.note.trim().length === 0) {
      return rejected(review, action, "MODIFICATION_NOTE_REQUIRED");
    }
    return accepted(review, action, {
      status: "modified",
      modificationNote: action.note.trim(),
    });
  }

  if (action.type === "handoff") {
    return accepted(review, action, { status: "handed_off" });
  }

  return accepted(review, action, { status: "rejected" });
}

export async function recordReviewAction(
  auditLog: FileAuditLog,
  review: ReviewCase,
  action: ReviewAction,
): Promise<ReviewActionResult> {
  const result = reviewAction(review, action);
  await auditLog.append({
    runId: review.runId,
    actorId: action.actorId,
    actorType: "synthetic-teller",
    workflowId: "operator.review",
    toolName: "operator.review.action",
    input: {
      action: action.type,
      actorId: action.actorId,
      runId: review.runId,
    },
    policyDecision: result.ok ? "allow" : "deny",
    result: result.ok ? "review_accepted" : "review_rejected",
    output: {
      action: result.auditEvent.action,
      result: result.auditEvent.result,
      reviewStatus: result.ok ? result.review.status : review.status,
      ...(action.type === "modify"
        ? {
            modificationNoteHash: hashModificationNote(action.note),
            modificationNoteLength: action.note.trim().length,
          }
        : {}),
    },
    terminationReason: result.ok ? undefined : result.reason,
  });
  return result;
}

function accepted(
  review: ReviewCase,
  action: ReviewAction,
  changes: Partial<ReviewCase>,
): ReviewActionResult {
  return {
    ok: true,
    review: { ...review, ...changes, executed: false },
    auditEvent: {
      action: action.type,
      actorId: action.actorId,
      runId: review.runId,
      result: "accepted",
      note: action.type === "modify" ? action.note.trim() : undefined,
    },
  };
}

function rejected(
  review: ReviewCase,
  action: ReviewAction,
  reason:
    | "REVIEW_NOT_READY"
    | "REVIEW_TERMINAL"
    | "REVIEW_DUPLICATE_ACTION"
    | "MODIFICATION_NOTE_REQUIRED",
): ReviewActionResult {
  return {
    ok: false,
    reason,
    auditEvent: {
      action: action.type,
      actorId: action.actorId,
      runId: review.runId,
      result: "rejected",
      note: action.type === "modify" ? action.note.trim() : undefined,
    },
  };
}

function hashModificationNote(note: string): string {
  return createHash("sha256").update(note.trim(), "utf8").digest("hex");
}
