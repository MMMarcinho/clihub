import { WorkflowStep } from "../core/types";
import { findWorkflow } from "../core/workflow";
import { permissionLines } from "./format";

function printStep(step: WorkflowStep, indent: string): void {
  if (step.parallel) {
    console.log(`${indent}- ${step.id}: [parallel group, ${step.parallel.length} steps]`);
    for (const child of step.parallel) printStep(child, indent + "  ");
    return;
  }
  const parts: string[] = [];
  if (step.run) parts.push(step.run);
  if (step.capture) parts.push(`[capture -> ${step.capture.as} (${step.capture.format})]`);
  if (step.assign) parts.push(`[assign: ${Object.keys(step.assign).join(", ")}]`);
  console.log(`${indent}- ${step.id}: ${parts.join(" ")}`);
}

export interface ShowOptions {
  json?: boolean;
}

export function showCommand(name: string, options: ShowOptions = {}): void {
  const wf = findWorkflow(name);

  if (options.json) {
    console.log(JSON.stringify(wf, null, 2));
    return;
  }

  console.log(`name: ${wf.name}`);
  console.log(`description: ${wf.description}`);
  console.log(`hub: ${wf.hub}`);
  console.log(`file: ${wf.file}`);

  const inputNames = Object.keys(wf.inputs);
  console.log(`\ninputs:`);
  if (inputNames.length === 0) {
    console.log(`  (none)`);
  } else {
    for (const inputName of inputNames) {
      const def = wf.inputs[inputName];
      const flags = [def.required ? "required" : "optional", def.default !== undefined ? `default=${def.default}` : null]
        .filter(Boolean)
        .join(", ");
      console.log(`  ${inputName} (${flags})${def.description ? `: ${def.description}` : ""}`);
    }
  }

  console.log(`\nrequires.tools: ${wf.requires.tools?.length ? wf.requires.tools.join(", ") : "(none)"}`);

  const permLines = permissionLines(wf.permissions);
  console.log(`\npermissions:`);
  if (permLines.length === 0) {
    console.log(`  (not declared)`);
  } else {
    for (const line of permLines) console.log(`  ${line}`);
  }

  console.log(`\nsteps:`);
  for (const step of wf.steps) {
    printStep(step, "  ");
  }
}
