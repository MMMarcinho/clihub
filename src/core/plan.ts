import { CaptureSpec, Workflow } from "./types";
import { renderForDisplay } from "./template";

const REF = /\{\{\s*(inputs|steps|captures|vars)\.([a-zA-Z0-9_.]+)\s*\}\}/g;

export interface PlannedStep {
  id: string;
  run?: string;
  displayCommand?: string;
  capture?: CaptureSpec;
  assign?: Record<string, string>;
  dependsOnSteps: string[];
}

function collectRefs(template: string): { kind: string; name: string }[] {
  const refs: { kind: string; name: string }[] = [];
  const re = new RegExp(REF);
  let match: RegExpExecArray | null;
  while ((match = re.exec(template)) !== null) {
    const [, kind, refPath] = match;
    refs.push({ kind, name: refPath.split(".")[0] });
  }
  return refs;
}

/**
 * Builds a static view of a workflow's steps without executing anything:
 * each step's (partially rendered) command plus which earlier steps it
 * depends on, derived from {{steps.*}}/{{captures.*}}/{{vars.*}} references.
 * Used by `explain` and `run --dry-run`.
 */
export function planWorkflow(workflow: Workflow, resolvedInputs?: Record<string, string>): PlannedStep[] {
  const captureOwner: Record<string, string> = {};
  const varOwner: Record<string, string> = {};
  for (const step of workflow.steps) {
    if (step.capture) captureOwner[step.capture.as] = step.id;
    if (step.assign) {
      for (const varName of Object.keys(step.assign)) {
        varOwner[varName] = step.id;
      }
    }
  }

  return workflow.steps.map((step) => {
    const templates = [step.run, ...(step.assign ? Object.values(step.assign) : [])].filter(
      (t): t is string => typeof t === "string"
    );

    const dependsOn = new Set<string>();
    for (const tmpl of templates) {
      for (const ref of collectRefs(tmpl)) {
        if (ref.kind === "steps" && ref.name !== step.id) {
          dependsOn.add(ref.name);
        } else if (ref.kind === "captures" && captureOwner[ref.name]) {
          dependsOn.add(captureOwner[ref.name]);
        } else if (ref.kind === "vars" && varOwner[ref.name]) {
          dependsOn.add(varOwner[ref.name]);
        }
      }
    }

    return {
      id: step.id,
      run: step.run,
      displayCommand: step.run ? renderForDisplay(step.run, resolvedInputs) : undefined,
      capture: step.capture,
      assign: step.assign,
      dependsOnSteps: [...dependsOn],
    };
  });
}
