import { spawnSync } from "child_process";
import * as path from "path";
import { StepResult, Workflow } from "./types";
import { renderTemplate, renderShellCommand, emptyContext, TemplateContext } from "./template";
import { applySelect, parseCaptureFormat } from "./capture";

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
  const ctx: TemplateContext = emptyContext(inputs);
  let success = true;

  for (const step of workflow.steps) {
    if (!success) {
      results.push({
        id: step.id,
        command: step.run ?? "",
        stdout: "",
        stderr: "",
        exitCode: null,
        durationMs: 0,
        skipped: true,
      });
      continue;
    }

    let result: StepResult;
    let captureFailed = false;

    if (step.run) {
      // Human-readable command for display/audit (StepResult.command, progress
      // output): values fully resolved and shell-quoted so nothing is hidden.
      const displayCommand = renderTemplate(step.run, ctx, "shell");
      options.onStepStart?.(step.id, displayCommand);

      // Actual command executed: references become "$VAR" env-var expansions
      // instead of literal text, so previous-step output can never be
      // reinterpreted as shell syntax (see renderShellCommand doc comment).
      const { command: execCommand, env: refEnv } = renderShellCommand(step.run, ctx);

      const stepCwd = step.cwd ? path.resolve(baseCwd, step.cwd) : baseCwd;
      const env = { ...process.env, ...refEnv, ...(step.env ?? {}) };

      const start = Date.now();
      const proc = spawnSync(execCommand, {
        shell: true,
        cwd: stepCwd,
        env,
        encoding: "utf8",
      });
      const durationMs = Date.now() - start;

      result = {
        id: step.id,
        command: displayCommand,
        stdout: proc.stdout ?? "",
        stderr: proc.stderr ?? "",
        exitCode: proc.status,
        durationMs,
      };

      if (step.capture) {
        try {
          const parsed = parseCaptureFormat(step.capture.format, result.stdout);
          result.parsed = parsed;
          ctx.captures[step.capture.as] = applySelect(parsed, step.capture.select);
        } catch (err) {
          result.stderr += (result.stderr ? "\n" : "") + `capture error: ${(err as Error).message}`;
          captureFailed = true;
        }
      }

      ctx.steps[step.id] = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        parsed: result.parsed,
      };
    } else {
      result = { id: step.id, command: "", stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
    }

    if (step.assign) {
      for (const [varName, tmpl] of Object.entries(step.assign)) {
        ctx.vars[varName] = renderTemplate(tmpl, ctx, "plain");
      }
    }

    results.push(result);
    options.onStepEnd?.(result);

    const failed = (step.run !== undefined && result.exitCode !== 0) || captureFailed;
    if (failed && !step.continueOnError) {
      success = false;
    }
  }

  return { success, results };
}
