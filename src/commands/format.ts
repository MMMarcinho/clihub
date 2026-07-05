import { WorkflowPermissions } from "../core/types";

export function permissionLines(p: WorkflowPermissions): string[] {
  const lines: string[] = [];
  if (p.network !== undefined) lines.push(`network: ${p.network}`);
  if (p.filesystem?.read !== undefined) lines.push(`filesystem.read: ${p.filesystem.read}`);
  if (p.filesystem?.write !== undefined) lines.push(`filesystem.write: ${p.filesystem.write}`);
  if (p.credentials?.length) lines.push(`credentials: ${p.credentials.join(", ")}`);
  if (p.destructive !== undefined) lines.push(`destructive: ${p.destructive}`);
  return lines;
}
