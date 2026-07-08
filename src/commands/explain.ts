import { findWorkflow } from "../core/workflow";
import { planWorkflow } from "../core/plan";
import { permissionLines } from "./format";

export interface ExplainOptions {
  json?: boolean;
}

export function explainCommand(name: string, options: ExplainOptions = {}): void {
  const wf = findWorkflow(name);
  const plan = planWorkflow(wf);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          name: wf.name,
          description: wf.description,
          hub: wf.hub,
          inputs: wf.inputs,
          requires: wf.requires,
          permissions: wf.permissions,
          steps: plan.map((step) => ({
            id: step.id,
            run: step.run,
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

  console.log(`${wf.name}: ${wf.description}`);
  console.log(`hub: ${wf.hub}`);
  console.log(`(explain does not execute anything)`);

  const inputNames = Object.keys(wf.inputs);
  console.log(`\ninputs:`);
  if (inputNames.length === 0) {
    console.log(`  (none)`);
  } else {
    for (const inputName of inputNames) {
      const def = wf.inputs[inputName];
      console.log(`  ${inputName} (${def.required ? "required" : "optional"})`);
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
  for (const step of plan) {
    console.log(`\n  [${step.id}]`);
    if (step.run) console.log(`    run: ${step.run}`);
    if (step.capture) console.log(`    capture -> ${step.capture.as} (${step.capture.format})`);
    if (step.assign) console.log(`    assign: ${Object.keys(step.assign).join(", ")}`);
    console.log(
      `    depends on steps: ${step.dependsOnSteps.length ? step.dependsOnSteps.join(", ") : "(none)"}`
    );
  }
}
