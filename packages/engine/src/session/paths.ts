import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { WORKSPACE_ROOT } from "../workspace";

/** Root of all persisted history, outside any project: `~/.babalcode/projects`. */
const PROJECTS_ROOT = path.join(os.homedir(), ".babalcode", "projects");

/**
 * Sessions are scoped to the workspace they were created in (like Claude Code),
 * keyed by a stable hash of the absolute workspace root so different projects
 * never share a history directory.
 */
function projectHash(): string {
  return createHash("sha256").update(WORKSPACE_ROOT).digest("hex").slice(0, 16);
}

/** The directory holding every session file for the current workspace. */
export function projectDir(): string {
  return path.join(PROJECTS_ROOT, projectHash());
}

/** Absolute path of a single session's append-only JSONL transcript. */
export function sessionFile(sessionId: string): string {
  return path.join(projectDir(), `${sessionId}.jsonl`);
}
