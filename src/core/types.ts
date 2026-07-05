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

export interface Workflow {
  name: string;
  description: string;
  inputs: Record<string, WorkflowInput>;
  requires: WorkflowRequires;
  permissions: WorkflowPermissions;
  steps: WorkflowStep[];
  file: string;
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
