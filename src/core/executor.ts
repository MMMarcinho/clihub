import { spawnSync } from "child_process";
import * as path from "path";
import { StepResult, Workflow } from "./types";
import { renderTemplate } from "./template";

export interface RunOptions {
  cwd?: string;
  onStepStart?: (id: string, command: string) => void;
  onStepEnd?: (result: StepResult) => void;
}

export interface RunOutcome {
  success: boolean;
  results: StepResult[];
}

export function runWorkflow(
  workflow: Workflow,
  inputs: Record<string, string>,
  options: RunOptions = {}
): RunOutcome {
  const baseCwd = options.cwd ?? process.cwd();
  const results: StepResult[] = [];
  let success = true;

  for (const step of workflow.steps) {
    if (!success) {
      results.push({
        id: step.id,
        command: step.run,
        stdout: "",
        stderr: "",
        exitCode: null,
        durationMs: 0,
        skipped: true,
      });
      continue;
    }

    const command = renderTemplate(step.run, inputs);
    options.onStepStart?.(step.id, command);

    const stepCwd = step.cwd ? path.resolve(baseCwd, step.cwd) : baseCwd;
    const env = step.env ? { ...process.env, ...step.env } : process.env;

    const start = Date.now();
    const proc = spawnSync(command, {
      shell: true,
      cwd: stepCwd,
      env,
      encoding: "utf8",
    });
    const durationMs = Date.now() - start;

    const result: StepResult = {
      id: step.id,
      command,
      stdout: proc.stdout ?? "",
      stderr: proc.stderr ?? "",
      exitCode: proc.status,
      durationMs,
    };
    results.push(result);
    options.onStepEnd?.(result);

    const failed = proc.status !== 0;
    if (failed && !step.continueOnError) {
      success = false;
    }
  }

  return { success, results };
}
