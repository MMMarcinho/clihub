import * as fs from "fs";
import { projectHubDir } from "../core/workflow";

export function initCommand(): void {
  const dir = projectHubDir();
  if (fs.existsSync(dir)) {
    console.log(`Already initialized: ${dir}`);
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Created ${dir}`);
  console.log(`Add workflow files there, e.g. ${dir}/my-workflow.yaml`);
}
