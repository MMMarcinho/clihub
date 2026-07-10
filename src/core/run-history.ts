import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { RunRecord, RunSummary } from "./types";
import { projectRunsDir } from "./workflow";

export function generateRunId(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${timestamp}-${suffix}`;
}

export function saveRun(record: RunRecord, cwd: string = process.cwd()): string {
  const dir = projectRunsDir(cwd);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${record.id}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));
  return file;
}

export function listRuns(cwd: string = process.cwd()): RunSummary[] {
  const dir = projectRunsDir(cwd);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const summaries: RunSummary[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".json")) continue;
    const file = path.join(dir, entry);
    try {
      const record = JSON.parse(fs.readFileSync(file, "utf8")) as RunRecord;
      summaries.push({
        id: record.id,
        workflow: record.workflow,
        success: record.success,
        startedAt: record.startedAt,
        durationMs: record.durationMs,
        file,
      });
    } catch {
      // skip unreadable/corrupt run trace files rather than failing the listing
    }
  }

  return summaries.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
