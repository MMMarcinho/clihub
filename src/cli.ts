#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { listCommand } from "./commands/list";
import { showCommand } from "./commands/show";
import { runCommand } from "./commands/run";
import { doctorCommand } from "./commands/doctor";
import { explainCommand } from "./commands/explain";
import { runsCommand } from "./commands/runs";

const program = new Command();

program.name("clihub").description("local-first CLI workflow hub").version("0.1.0");

program
  .command("init")
  .description("initialize a .clihub/workflows directory (project-level by default)")
  .option("--user", "initialize the user-level hub (~/.clihub/workflows) instead")
  .action((options: { user?: boolean }) => {
    withErrorHandling(() => initCommand(options));
  });

program
  .command("list")
  .description("list available workflows")
  .option("--json", "output JSON")
  .action((options: { json?: boolean }) => {
    withErrorHandling(() => listCommand(options));
  });

program
  .command("show <workflow>")
  .description("show a workflow's inputs and steps")
  .option("--json", "output JSON")
  .action((workflow: string, options: { json?: boolean }) => {
    withErrorHandling(() => showCommand(workflow, options));
  });

program
  .command("run <workflow>")
  .description("run a workflow")
  .option("--input <key=value>", "set a workflow input (repeatable)", (value, prev: string[]) => {
    prev.push(value);
    return prev;
  }, [] as string[])
  .option("--json", "output JSON")
  .option("--dry-run", "show planned commands and data dependencies without executing")
  .action(async (workflow: string, options: { input: string[]; json?: boolean; dryRun?: boolean }) => {
    await withErrorHandling(() => runCommand(workflow, options.input, options));
  });

program
  .command("doctor <workflow>")
  .description("check whether the environment satisfies a workflow's requirements")
  .option("--json", "output JSON")
  .action((workflow: string, options: { json?: boolean }) => {
    withErrorHandling(() => doctorCommand(workflow, options));
  });

program
  .command("explain <workflow>")
  .description("explain what a workflow would do, without executing it")
  .option("--json", "output JSON")
  .action((workflow: string, options: { json?: boolean }) => {
    withErrorHandling(() => explainCommand(workflow, options));
  });

program
  .command("runs")
  .description("list recorded runs (from .clihub/runs)")
  .option("--json", "output JSON")
  .action((options: { json?: boolean }) => {
    withErrorHandling(() => runsCommand(options));
  });

async function withErrorHandling(fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

program.parseAsync(process.argv);
