import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { Workflow, WorkflowInput, WorkflowStep } from "./types";

export const WORKFLOWS_DIR = path.join(".clihub", "workflows");

export function projectHubDir(cwd: string = process.cwd()): string {
  return path.join(cwd, WORKFLOWS_DIR);
}

export function listWorkflowFiles(cwd: string = process.cwd()): string[] {
  const dir = projectHubDir(cwd);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .map((f) => path.join(dir, f))
    .sort();
}

function assertString(value: unknown, field: string, file: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`workflow ${file}: "${field}" must be a non-empty string`);
  }
  return value;
}

function parseInputs(raw: unknown, file: string): Record<string, WorkflowInput> {
  if (raw === undefined) return {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`workflow ${file}: "inputs" must be a map`);
  }
  const inputs: Record<string, WorkflowInput> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const v = (value ?? {}) as Record<string, unknown>;
    inputs[key] = {
      description: typeof v.description === "string" ? v.description : undefined,
      required: Boolean(v.required),
      default: typeof v.default === "string" ? v.default : undefined,
    };
  }
  return inputs;
}

function parseSteps(raw: unknown, file: string): WorkflowStep[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`workflow ${file}: "steps" must be a non-empty list`);
  }
  const seenIds = new Set<string>();
  return raw.map((entry, index) => {
    const step = (entry ?? {}) as Record<string, unknown>;
    const id = assertString(step.id, `steps[${index}].id`, file);
    if (seenIds.has(id)) {
      throw new Error(`workflow ${file}: duplicate step id "${id}"`);
    }
    seenIds.add(id);
    const run = assertString(step.run, `steps[${index}].run`, file);
    const result: WorkflowStep = { id, run };
    if (typeof step.cwd === "string") result.cwd = step.cwd;
    if (step.env && typeof step.env === "object") {
      result.env = step.env as Record<string, string>;
    }
    if (typeof step.continueOnError === "boolean") {
      result.continueOnError = step.continueOnError;
    }
    return result;
  });
}

export function parseWorkflow(source: string, file: string): Workflow {
  const raw = yaml.load(source);
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`workflow ${file}: file must contain a YAML mapping`);
  }
  const doc = raw as Record<string, unknown>;
  const name = assertString(doc.name, "name", file);
  const description = assertString(doc.description, "description", file);
  const inputs = parseInputs(doc.inputs, file);
  const steps = parseSteps(doc.steps, file);
  const requiresRaw = (doc.requires ?? {}) as Record<string, unknown>;
  const tools = Array.isArray(requiresRaw.tools)
    ? requiresRaw.tools.filter((t): t is string => typeof t === "string")
    : [];

  return {
    name,
    description,
    inputs,
    requires: { tools },
    steps,
    file,
  };
}

export function loadWorkflowFile(file: string): Workflow {
  const source = fs.readFileSync(file, "utf8");
  return parseWorkflow(source, file);
}

export function listWorkflows(cwd: string = process.cwd()): Workflow[] {
  return listWorkflowFiles(cwd).map(loadWorkflowFile);
}

export function findWorkflow(name: string, cwd: string = process.cwd()): Workflow {
  const matches = listWorkflows(cwd).filter((w) => w.name === name);
  if (matches.length === 0) {
    throw new Error(`workflow "${name}" not found in ${projectHubDir(cwd)}`);
  }
  return matches[0];
}

export function resolveInputs(
  workflow: Workflow,
  provided: Record<string, string>
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const missing: string[] = [];

  for (const [name, def] of Object.entries(workflow.inputs)) {
    if (provided[name] !== undefined) {
      resolved[name] = provided[name];
    } else if (def.default !== undefined) {
      resolved[name] = def.default;
    } else if (def.required) {
      missing.push(name);
    }
  }

  for (const [name, value] of Object.entries(provided)) {
    if (!(name in workflow.inputs)) {
      resolved[name] = value;
    }
  }

  if (missing.length > 0) {
    throw new Error(`missing required input(s): ${missing.join(", ")}`);
  }

  return resolved;
}
