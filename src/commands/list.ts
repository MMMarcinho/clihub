import { listWorkflows, projectHubDir } from "../core/workflow";

export function listCommand(): void {
  const workflows = listWorkflows();
  if (workflows.length === 0) {
    console.log(`No workflows found in ${projectHubDir()}. Run "clihub init" first.`);
    return;
  }
  for (const wf of workflows) {
    console.log(`${wf.name}\t${wf.description}`);
  }
}
