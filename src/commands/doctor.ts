import { checkTools } from "../core/tool-check";
import { findWorkflow } from "../core/workflow";

export function doctorCommand(name: string): void {
  const wf = findWorkflow(name);
  console.log(`Doctor report for "${wf.name}"`);

  let ok = true;

  const tools = wf.requires.tools ?? [];
  console.log(`\ntools:`);
  if (tools.length === 0) {
    console.log(`  (none required)`);
  } else {
    for (const { tool, found } of checkTools(tools)) {
      console.log(`  [${found ? "OK" : "MISSING"}] ${tool}`);
      if (!found) ok = false;
    }
  }

  const requiredInputs = Object.entries(wf.inputs).filter(([, def]) => def.required);
  console.log(`\nrequired inputs:`);
  if (requiredInputs.length === 0) {
    console.log(`  (none)`);
  } else {
    for (const [inputName, def] of requiredInputs) {
      const hasDefault = def.default !== undefined;
      console.log(`  [${hasDefault ? "OK (has default)" : "NEEDS --input"}] ${inputName}`);
    }
  }

  console.log(`\n${ok ? "PASS" : "FAIL"}: ${ok ? "workflow can run" : "missing required tool(s), see above"}`);
  if (!ok) {
    process.exitCode = 1;
  }
}
