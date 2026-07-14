import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  CaptureFormat,
  CaptureSpec,
  HubScope,
  Workflow,
  WorkflowInput,
  WorkflowPermissions,
  WorkflowStep,
} from "./types";

export const WORKFLOWS_DIR = path.join(".clihub", "workflows");
export const RUNS_DIR = path.join(".clihub", "runs");

export function projectHubDir(cwd: string = process.cwd()): string {
  return path.join(cwd, WORKFLOWS_DIR);
}

export function userHubDir(): string {
  return path.join(os.homedir(), ".clihub", "workflows");
}

export function projectRunsDir(cwd: string = process.cwd()): string {
  return path.join(cwd, RUNS_DIR);
}

function listYamlFiles(dir: string): string[] {
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

const CAPTURE_FORMATS: CaptureFormat[] = ["text", "json", "lines"];

function parseCapture(raw: unknown, file: string, pathLabel: string): CaptureSpec | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "string") {
    return { as: raw, format: "text" };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`workflow ${file}: ${pathLabel}.capture must be a string or a map`);
  }
  const obj = raw as Record<string, unknown>;
  const as = assertString(obj.as, `${pathLabel}.capture.as`, file);
  const format = obj.format ?? "text";
  if (!CAPTURE_FORMATS.includes(format as CaptureFormat)) {
    throw new Error(`workflow ${file}: ${pathLabel}.capture.format must be one of ${CAPTURE_FORMATS.join(", ")}`);
  }
  let select: Record<string, string> | undefined;
  if (obj.select !== undefined) {
    if (typeof obj.select !== "object" || obj.select === null || Array.isArray(obj.select)) {
      throw new Error(`workflow ${file}: ${pathLabel}.capture.select must be a map`);
    }
    select = {};
    for (const [key, value] of Object.entries(obj.select as Record<string, unknown>)) {
      select[key] = assertString(value, `${pathLabel}.capture.select.${key}`, file);
    }
  }
  return { as, format: format as CaptureFormat, select };
}

function parseAssign(raw: unknown, file: string, pathLabel: string): Record<string, string> | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`workflow ${file}: ${pathLabel}.assign must be a map`);
  }
  const assign: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    assign[key] = assertString(value, `${pathLabel}.assign.${key}`, file);
  }
  return assign;
}

function parseStep(
  entry: unknown,
  file: string,
  pathLabel: string,
  seenIds: Set<string>,
  allowParallel: boolean
): WorkflowStep {
  const step = (entry ?? {}) as Record<string, unknown>;
  const id = assertString(step.id, `${pathLabel}.id`, file);
  if (seenIds.has(id)) {
    throw new Error(`workflow ${file}: duplicate step id "${id}"`);
  }
  seenIds.add(id);

  if (step.parallel !== undefined) {
    if (!allowParallel) {
      throw new Error(`workflow ${file}: ${pathLabel} ("${id}") cannot nest "parallel" inside a parallel group`);
    }
    if (step.run !== undefined || step.capture !== undefined || step.assign !== undefined) {
      throw new Error(
        `workflow ${file}: ${pathLabel} ("${id}") cannot combine "parallel" with "run"/"capture"/"assign"`
      );
    }
    if (!Array.isArray(step.parallel) || step.parallel.length === 0) {
      throw new Error(`workflow ${file}: ${pathLabel}.parallel must be a non-empty list`);
    }
    const children = step.parallel.map((child, childIndex) =>
      parseStep(child, file, `${pathLabel}.parallel[${childIndex}]`, seenIds, false)
    );
    return { id, parallel: children };
  }

  const run = typeof step.run === "string" && step.run.trim() !== "" ? step.run : undefined;
  const capture = parseCapture(step.capture, file, pathLabel);
  const assign = parseAssign(step.assign, file, pathLabel);
  if (!run && !assign) {
    throw new Error(`workflow ${file}: ${pathLabel} ("${id}") must have "run" or "assign"`);
  }

  const result: WorkflowStep = { id };
  if (run) result.run = run;
  if (capture) result.capture = capture;
  if (assign) result.assign = assign;
  if (typeof step.cwd === "string") result.cwd = step.cwd;
  if (step.env && typeof step.env === "object") {
    result.env = step.env as Record<string, string>;
  }
  if (typeof step.continueOnError === "boolean") {
    result.continueOnError = step.continueOnError;
  }
  return result;
}

function parseSteps(raw: unknown, file: string): WorkflowStep[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`workflow ${file}: "steps" must be a non-empty list`);
  }
  const seenIds = new Set<string>();
  return raw.map((entry, index) => parseStep(entry, file, `steps[${index}]`, seenIds, true));
}

function parsePermissions(raw: unknown, file: string): WorkflowPermissions {
  if (raw === undefined) return {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error(`workflow ${file}: "permissions" must be a map`);
  }
  const obj = raw as Record<string, unknown>;
  const permissions: WorkflowPermissions = {};
  if (typeof obj.network === "boolean") permissions.network = obj.network;
  if (obj.filesystem !== undefined) {
    if (typeof obj.filesystem !== "object" || obj.filesystem === null || Array.isArray(obj.filesystem)) {
      throw new Error(`workflow ${file}: "permissions.filesystem" must be a map`);
    }
    const fsObj = obj.filesystem as Record<string, unknown>;
    permissions.filesystem = {};
    if (typeof fsObj.read === "boolean") permissions.filesystem.read = fsObj.read;
    if (typeof fsObj.write === "boolean") permissions.filesystem.write = fsObj.write;
  }
  if (obj.credentials !== undefined) {
    if (!Array.isArray(obj.credentials)) {
      throw new Error(`workflow ${file}: "permissions.credentials" must be a list`);
    }
    permissions.credentials = obj.credentials.filter((c): c is string => typeof c === "string");
  }
  if (typeof obj.destructive === "boolean") permissions.destructive = obj.destructive;
  return permissions;
}

export function parseWorkflow(source: string, file: string, hub: HubScope = "project"): Workflow {
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
  const permissions = parsePermissions(doc.permissions, file);

  return {
    name,
    description,
    inputs,
    requires: { tools },
    permissions,
    steps,
    file,
    hub,
  };
}

export function loadWorkflowFile(file: string, hub: HubScope = "project"): Workflow {
  const source = fs.readFileSync(file, "utf8");
  return parseWorkflow(source, file, hub);
}

/**
 * Lists workflows from the project hub (`.clihub/workflows`) and the user
 * hub (`~/.clihub/workflows`), per SPEC's resolution order. When both hubs
 * define a workflow with the same name, the project-level one wins and the
 * user-level one is dropped from the result.
 */
export function listWorkflows(cwd: string = process.cwd()): Workflow[] {
  const projectWorkflows = listYamlFiles(projectHubDir(cwd)).map((file) => loadWorkflowFile(file, "project"));
  const userWorkflows = listYamlFiles(userHubDir()).map((file) => loadWorkflowFile(file, "user"));

  const projectNames = new Set(projectWorkflows.map((w) => w.name));
  const merged = [...projectWorkflows, ...userWorkflows.filter((w) => !projectNames.has(w.name))];

  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function findWorkflow(name: string, cwd: string = process.cwd()): Workflow {
  const match = listWorkflows(cwd).find((w) => w.name === name);
  if (!match) {
    throw new Error(
      `workflow "${name}" not found in ${projectHubDir(cwd)} or ${userHubDir()}`
    );
  }
  return match;
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
