import { checkTools } from "../core/tool-check";
import { runWorkflow } from "../core/executor";
import { findWorkflow, resolveInputs } from "../core/workflow";

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

export function runCommand(name: string, rawInputs: string[]): void {
  const wf = findWorkflow(name);
  const inputs = resolveInputs(wf, parseInputFlags(rawInputs));

  const tools = wf.requires.tools ?? [];
  if (tools.length > 0) {
    const checked = checkTools(tools);
    const missing = checked.filter((t) => !t.found);
    if (missing.length > 0) {
      console.error(`Missing required tool(s): ${missing.map((t) => t.tool).join(", ")}`);
      process.exitCode = 1;
      return;
    }
  }

  console.log(`Running workflow "${wf.name}"`);

  const outcome = runWorkflow(wf, inputs, {
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
  });

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
