import { listRuns } from "../core/run-history";

export interface RunsOptions {
  json?: boolean;
}

export function runsCommand(options: RunsOptions = {}): void {
  const runs = listRuns();

  if (options.json) {
    console.log(JSON.stringify(runs, null, 2));
    return;
  }

  if (runs.length === 0) {
    console.log(`No recorded runs. Runs are recorded automatically by "clihub run".`);
    return;
  }

  for (const run of runs) {
    console.log(`${run.id}\t${run.workflow}\t${run.success ? "success" : "failed"}\t${run.startedAt}\t${run.durationMs}ms`);
  }
}
