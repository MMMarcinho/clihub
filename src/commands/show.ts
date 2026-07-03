import { findWorkflow } from "../core/workflow";

export function showCommand(name: string): void {
  const wf = findWorkflow(name);

  console.log(`name: ${wf.name}`);
  console.log(`description: ${wf.description}`);
  console.log(`file: ${wf.file}`);

  const inputNames = Object.keys(wf.inputs);
  console.log(`\ninputs:`);
  if (inputNames.length === 0) {
    console.log(`  (none)`);
  } else {
    for (const name of inputNames) {
      const def = wf.inputs[name];
      const flags = [def.required ? "required" : "optional", def.default !== undefined ? `default=${def.default}` : null]
        .filter(Boolean)
        .join(", ");
      console.log(`  ${name} (${flags})${def.description ? `: ${def.description}` : ""}`);
    }
  }

  console.log(`\nrequires.tools: ${wf.requires.tools?.length ? wf.requires.tools.join(", ") : "(none)"}`);

  console.log(`\nsteps:`);
  for (const step of wf.steps) {
    const parts: string[] = [];
    if (step.run) parts.push(step.run);
    if (step.capture) parts.push(`[capture -> ${step.capture.as} (${step.capture.format})]`);
    if (step.assign) parts.push(`[assign: ${Object.keys(step.assign).join(", ")}]`);
    console.log(`  - ${step.id}: ${parts.join(" ")}`);
  }
}
