import { getPath } from "./path";

export interface StepContext {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  parsed?: unknown;
}

export interface TemplateContext {
  inputs: Record<string, string>;
  steps: Record<string, StepContext>;
  captures: Record<string, unknown>;
  vars: Record<string, string>;
}

export function emptyContext(inputs: Record<string, string>): TemplateContext {
  return { inputs, steps: {}, captures: {}, vars: {} };
}

export type RenderMode = "shell" | "plain";

const REF = /\{\{\s*(inputs|steps|captures|vars)\.([a-zA-Z0-9_.]+)\s*\}\}/g;

/**
 * Single-quotes a value for POSIX shells so interpolated values are always
 * treated as one literal argument, never as extra shell syntax.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function resolveRef(kind: string, refPath: string, ctx: TemplateContext): unknown {
  const segments = refPath.split(".");
  switch (kind) {
    case "inputs":
      return ctx.inputs[segments[0]];
    case "vars":
      return ctx.vars[segments[0]];
    case "captures": {
      const [name, ...rest] = segments;
      const base = ctx.captures[name];
      return rest.length > 0 ? getPath(base, rest) : base;
    }
    case "steps": {
      const [id, field, ...rest] = segments;
      const step = ctx.steps[id];
      if (!step) return undefined;
      if (field === "stdout") return step.stdout;
      if (field === "stderr") return step.stderr;
      if (field === "exitCode") return step.exitCode;
      if (field === "parsed") return rest.length > 0 ? getPath(step.parsed, rest) : step.parsed;
      return undefined;
    }
    default:
      return undefined;
  }
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value.join("\n");
  }
  return JSON.stringify(value);
}

export function renderTemplate(template: string, ctx: TemplateContext, mode: RenderMode): string {
  return template.replace(REF, (_match, kind: string, refPath: string) => {
    const value = resolveRef(kind, refPath, ctx);
    if (value === undefined) {
      throw new Error(`unknown template reference {{${kind}.${refPath}}}`);
    }
    const text = stringifyValue(value);
    return mode === "shell" ? shellQuote(text) : text;
  });
}

/**
 * Renders a template for human display without executing anything. Only
 * `{{inputs.x}}` references are resolved (when a value is known); everything
 * else (`{{steps.*}}`, `{{captures.*}}`, `{{vars.*}}`, unresolved inputs) is
 * left as the literal `{{...}}` placeholder, since those values only exist
 * once earlier steps have actually run. Used by `explain` and `run --dry-run`
 * so a workflow's data dependencies stay visible instead of being hidden.
 */
export function renderForDisplay(template: string, resolvedInputs?: Record<string, string>): string {
  return template.replace(REF, (match, kind: string, refPath: string) => {
    if (kind === "inputs" && resolvedInputs) {
      const name = refPath.split(".")[0];
      if (name in resolvedInputs) {
        return shellQuote(resolvedInputs[name]);
      }
    }
    return match;
  });
}

/**
 * Renders a `run` template for actual execution. Instead of splicing
 * resolved values (which may come from a previous step's captured output,
 * i.e. attacker-influenced) directly into the shell command string, each
 * distinct reference is exported as an environment variable and replaced
 * with a quoted `"$VAR"` expansion. A shell does not re-parse the *contents*
 * of an expanded variable as command syntax, so this is safe even if the
 * value contains quotes, `$(...)`, backticks, `;`, etc. — unlike embedding
 * the value literally (even single-quoted) into the command text.
 */
export function renderShellCommand(
  template: string,
  ctx: TemplateContext
): { command: string; env: Record<string, string> } {
  const env: Record<string, string> = {};
  const varNameByRef = new Map<string, string>();
  let counter = 0;

  const command = template.replace(REF, (match, kind: string, refPath: string) => {
    const existing = varNameByRef.get(match);
    if (existing) {
      return `"$${existing}"`;
    }
    const value = resolveRef(kind, refPath, ctx);
    if (value === undefined) {
      throw new Error(`unknown template reference {{${kind}.${refPath}}}`);
    }
    counter += 1;
    const varName = `CLIHUB_REF_${counter}`;
    env[varName] = stringifyValue(value);
    varNameByRef.set(match, varName);
    return `"$${varName}"`;
  });

  return { command, env };
}
