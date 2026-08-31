import { randomUUID } from "node:crypto";

export type RunStatus =
  | "created"
  | "classified"
  | "approved"
  | "executing"
  | "verifying"
  | "completed"
  | "handoff"
  | "denied"
  | "failed";

export interface RunEvent {
  from: RunStatus;
  to: RunStatus;
  at: string;
}

export interface AgentRun {
  runId: string;
  workflowId: string;
  actorType: string;
  status: RunStatus;
  createdAt: string;
  events: RunEvent[];
}

const transitions: Record<RunStatus, RunStatus[]> = {
  created: ["classified", "handoff", "denied", "failed"],
  classified: ["approved", "handoff", "denied", "failed"],
  approved: ["executing", "handoff", "denied", "failed"],
  executing: ["verifying", "handoff", "failed"],
  verifying: ["completed", "handoff", "failed"],
  completed: [],
  handoff: [],
  denied: [],
  failed: [],
};

export function createRun(workflowId: string, actorType: string): AgentRun {
  const createdAt = new Date().toISOString();
  return {
    runId: `RUN-${randomUUID()}`,
    workflowId,
    actorType,
    status: "created",
    createdAt,
    events: [],
  };
}

export function transitionRun(run: AgentRun, next: RunStatus): AgentRun {
  if (transitions[run.status].length === 0) {
    throw new Error("RUN_TERMINAL");
  }
  if (!transitions[run.status].includes(next)) {
    throw new Error("INVALID_RUN_TRANSITION");
  }

  return {
    ...run,
    status: next,
    events: [
      ...run.events,
      { from: run.status, to: next, at: new Date().toISOString() },
    ],
  };
}
