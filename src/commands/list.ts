import { listWorkflows, projectHubDir, userHubDir } from "../core/workflow";

export interface ListOptions {
  json?: boolean;
}

export function listCommand(options: ListOptions = {}): void {
  const workflows = listWorkflows();

  if (options.json) {
    console.log(
      JSON.stringify(
        workflows.map((wf) => ({ name: wf.name, description: wf.description, hub: wf.hub, file: wf.file })),
        null,
        2
      )
    );
    return;
  }

  if (workflows.length === 0) {
    console.log(`No workflows found in ${projectHubDir()} or ${userHubDir()}. Run "clihub init" first.`);
    return;
  }
  for (const wf of workflows) {
    console.log(`${wf.name}\t[${wf.hub}]\t${wf.description}`);
  }
}
