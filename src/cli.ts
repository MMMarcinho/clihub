#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init";
import { listCommand } from "./commands/list";
import { showCommand } from "./commands/show";
import { runCommand } from "./commands/run";
import { doctorCommand } from "./commands/doctor";

const program = new Command();

program.name("clihub").description("local-first CLI workflow hub").version("0.1.0");

program
  .command("init")
  .description("initialize a project-level .clihub/workflows directory")
  .action(() => {
    withErrorHandling(() => initCommand());
  });

program
  .command("list")
  .description("list available workflows")
  .action(() => {
    withErrorHandling(() => listCommand());
  });

program
  .command("show <workflow>")
  .description("show a workflow's inputs and steps")
  .action((workflow: string) => {
    withErrorHandling(() => showCommand(workflow));
  });

program
  .command("run <workflow>")
  .description("run a workflow")
  .option("--input <key=value>", "set a workflow input (repeatable)", (value, prev: string[]) => {
    prev.push(value);
    return prev;
  }, [] as string[])
  .action((workflow: string, options: { input: string[] }) => {
    withErrorHandling(() => runCommand(workflow, options.input));
  });

program
  .command("doctor <workflow>")
  .description("check whether the environment satisfies a workflow's requirements")
  .action((workflow: string) => {
    withErrorHandling(() => doctorCommand(workflow));
  });

function withErrorHandling(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

program.parse(process.argv);
