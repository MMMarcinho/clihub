export interface WorkflowInput {
  description?: string;
  required?: boolean;
  default?: string;
}

export interface WorkflowStep {
  id: string;
  run: string;
  cwd?: string;
  env?: Record<string, string>;
  continueOnError?: boolean;
}

export interface WorkflowRequires {
  tools?: string[];
}

export interface Workflow {
  name: string;
  description: string;
  inputs: Record<string, WorkflowInput>;
  requires: WorkflowRequires;
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
}
