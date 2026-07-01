import { spawnSync } from "child_process";

export function toolExists(tool: string): boolean {
  const checker = process.platform === "win32" ? "where" : "command -v";
  const result = spawnSync(`${checker} ${tool}`, { shell: true, stdio: "ignore" });
  return result.status === 0;
}

export function checkTools(tools: string[]): { tool: string; found: boolean }[] {
  return tools.map((tool) => ({ tool, found: toolExists(tool) }));
}
