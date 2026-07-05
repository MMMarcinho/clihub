import { checkTools } from "../core/tool-check";
import { runWorkflow } from "../core/executor";
import { planWorkflow } from "../core/plan";
import { findWorkflow, resolveInputs } from "../core/workflow";

export interface RunCommandOptions {
  json?: boolean;
  dryRun?: boolean;
}

function parseInputFlags(raw: string[]): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const entry of raw) {
    const eq = entry.indexOf("=");
    if (eq === -1) {
      throw new Error(`invalid --input "${entry}", expected key=value`);
    }
    inputs[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  return inputs;
}

function runDry(name: string, rawInputs: string[], options: RunCommandOptions): void {
  const wf = findWorkflow(name);
  const inputs = resolveInputs(wf, parseInputFlags(rawInputs));
  const plan = planWorkflow(wf, inputs);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          name: wf.name,
          dryRun: true,
          inputs,
          steps: plan.map((step) => ({
            id: step.id,
            command: step.displayCommand,
            capture: step.capture,
            assign: step.assign ? Object.keys(step.assign) : undefined,
            dependsOnSteps: step.dependsOnSteps,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Dry run for "${wf.name}" (nothing will be executed)`);
  for (const step of plan) {
    console.log(`\n[${step.id}]`);
    if (step.displayCommand) console.log(`  $ ${step.displayCommand}`);
    if (step.capture) console.log(`  capture -> ${step.capture.as} (${step.capture.format})`);
    if (step.assign) console.log(`  assign: ${Object.keys(step.assign).join(", ")}`);
    console.log(
      `  depends on steps: ${step.dependsOnSteps.length ? step.dependsOnSteps.join(", ") : "(none)"}`
    );
  }
}

export function runCommand(name: string, rawInputs: string[], options: RunCommandOptions = {}): void {
  if (options.dryRun) {
    runDry(name, rawInputs, options);
    return;
  }

  const wf = findWorkflow(name);
  const inputs = resolveInputs(wf, parseInputFlags(rawInputs));

  const tools = wf.requires.tools ?? [];
  if (tools.length > 0) {
    const checked = checkTools(tools);
    const missing = checked.filter((t) => !t.found);
    if (missing.length > 0) {
      const message = `missing required tool(s): ${missing.map((t) => t.tool).join(", ")}`;
      if (options.json) {
        console.log(JSON.stringify({ name: wf.name, success: false, error: message }, null, 2));
      } else {
        console.error(`Missing required tool(s): ${missing.map((t) => t.tool).join(", ")}`);
      }
      process.exitCode = 1;
      return;
    }
  }

  if (!options.json) {
    console.log(`Running workflow "${wf.name}"`);
  }

  const outcome = runWorkflow(
    wf,
    inputs,
    options.json
      ? {}
      : {
          onStepStart: (id, command) => {
            console.log(`\n[${id}] $ ${command}`);
          },
          onStepEnd: (result) => {
            if (!result.command) {
              console.log(`\n[${result.id}] (assign only, no command)`);
              return;
            }
            if (result.stdout) process.stdout.write(result.stdout);
            if (result.stderr) process.stderr.write(result.stderr);
            console.log(`[${result.id}] exit=${result.exitCode} duration=${result.durationMs}ms`);
          },
        }
  );

  if (options.json) {
    console.log(JSON.stringify({ name: wf.name, success: outcome.success, results: outcome.results }, null, 2));
    if (!outcome.success) process.exitCode = 1;
    return;
  }

  for (const result of outcome.results) {
    if (result.skipped) {
      console.log(`\n[${result.id}] skipped (previous step failed)`);
    }
  }

  if (!outcome.success) {
    console.error(`\nWorkflow "${wf.name}" failed`);
    process.exitCode = 1;
    return;
  }

  console.log(`\nWorkflow "${wf.name}" completed successfully`);
}
