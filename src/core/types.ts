export interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
}

export type CaptureFormat = "text" | "json" | "lines";

export interface CaptureSpec {
  as: string;
  format: CaptureFormat;
  select?: Record<string, string>;
}

export interface WorkflowStep {
  id: string;
  run?: string;
  cwd?: string;
  env?: Record<string, string>;
  continueOnError?: boolean;
  capture?: CaptureSpec;
  assign?: Record<string, string>;
  /**
   * A group of steps that run concurrently instead of sequentially. Only
   * one level deep — a parallel child cannot itself declare `parallel`. A
   * step with `parallel` set has no `run`/`capture`/`assign` of its own;
   * it's purely a grouping marker.
   */
  parallel?: WorkflowStep[];
}

export interface WorkflowRequires {
  tools?: string[];
}

export interface WorkflowPermissions {
  network?: boolean;
  filesystem?: {
    read?: boolean;
    write?: boolean;
  };
  credentials?: string[];
  destructive?: boolean;
}

export type HubScope = "project" | "user";

export interface Workflow {
  name: string;
  description: string;
  inputs: Record<string, WorkflowInput>;
  requires: WorkflowRequires;
  permissions: WorkflowPermissions;
  steps: WorkflowStep[];
  file: string;
  hub: HubScope;
}

export interface StepResult {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  skipped?: boolean;
  parsed?: unknown;
}

export interface RunRecord {
  id: string;
  workflow: string;
  hub: HubScope;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  inputs: Record<string, string>;
  success: boolean;
  steps: StepResult[];
}

export interface RunSummary {
  id: string;
  workflow: string;
  success: boolean;
  startedAt: string;
  durationMs: number;
  file: string;
}
