import * as fs from "fs";
import { projectHubDir, userHubDir } from "../core/workflow";

export interface InitOptions {
  user?: boolean;
}

export function initCommand(options: InitOptions = {}): void {
  const dir = options.user ? userHubDir() : projectHubDir();
  if (fs.existsSync(dir)) {
    console.log(`Already initialized: ${dir}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Created ${dir}`);
  console.log(`Add workflow files there, e.g. ${dir}/my-workflow.yaml`);
}
