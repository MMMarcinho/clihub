import { listWorkflows, projectHubDir } from "../core/workflow";

export interface ListOptions {
  json?: boolean;
}

export function listCommand(options: ListOptions = {}): void {
  const workflows = listWorkflows();

  if (options.json) {
    console.log(
      JSON.stringify(
        workflows.map((wf) => ({ name: wf.name, description: wf.description, file: wf.file })),
        null,
        2
      )
    );
    return;
  }

  if (workflows.length === 0) {
    console.log(`No workflows found in ${projectHubDir()}. Run "clihub init" first.`);
    return;
  }
  for (const wf of workflows) {
    console.log(`${wf.name}\t${wf.description}`);
  }
}
