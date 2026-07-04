import { CaptureFormat } from "./types";
import { getPath } from "./path";

export function parseCaptureFormat(format: CaptureFormat, stdout: string): unknown {
  switch (format) {
    case "text":
      return stdout.replace(/\n$/, "");
    case "lines": {
      const lines = stdout.split("\n");
      if (lines.length > 0 && lines[lines.length - 1] === "") {
        lines.pop();
      }
      return lines;
    }
    case "json":
      try {
        return JSON.parse(stdout);
      } catch (err) {
        throw new Error(`failed to parse stdout as JSON: ${(err as Error).message}`);
      }
  }
}

export function applySelect(parsed: unknown, select?: Record<string, string>): unknown {
  if (!select) return parsed;
  const result: Record<string, unknown> = {};
  for (const [key, fieldPath] of Object.entries(select)) {
    result[key] = getPath(parsed, fieldPath.split("."));
  }
  return result;
}
