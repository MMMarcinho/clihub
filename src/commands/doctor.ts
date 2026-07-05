import { checkTools } from "../core/tool-check";
import { findWorkflow } from "../core/workflow";

export interface DoctorOptions {
  json?: boolean;
}

export function doctorCommand(name: string, options: DoctorOptions = {}): void {
  const wf = findWorkflow(name);

  const tools = wf.requires.tools ?? [];
  const toolChecks = checkTools(tools);
  const ok = toolChecks.every((t) => t.found);

  const requiredInputs = Object.entries(wf.inputs)
    .filter(([, def]) => def.required)
    .map(([inputName, def]) => ({ name: inputName, hasDefault: def.default !== undefined }));

  if (options.json) {
    console.log(JSON.stringify({ workflow: wf.name, ok, tools: toolChecks, requiredInputs }, null, 2));
    if (!ok) process.exitCode = 1;
    return;
  }

  console.log(`Doctor report for "${wf.name}"`);

  console.log(`\ntools:`);
  if (toolChecks.length === 0) {
    console.log(`  (none required)`);
  } else {
    for (const { tool, found } of toolChecks) {
      console.log(`  [${found ? "OK" : "MISSING"}] ${tool}`);
    }
  }

  console.log(`\nrequired inputs:`);
  if (requiredInputs.length === 0) {
    console.log(`  (none)`);
  } else {
    for (const { name: inputName, hasDefault } of requiredInputs) {
      console.log(`  [${hasDefault ? "OK (has default)" : "NEEDS --input"}] ${inputName}`);
    }
  }

  console.log(`\n${ok ? "PASS" : "FAIL"}: ${ok ? "workflow can run" : "missing required tool(s), see above"}`);
  if (!ok) {
    process.exitCode = 1;
  }
}
