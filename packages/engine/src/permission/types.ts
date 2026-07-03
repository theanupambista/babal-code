import type { ToolName } from "../modes";

/** The three outcomes of a rule evaluation. */
export type PermissionAction = "allow" | "ask" | "deny";

/**
 * What a tool is asking permission to do. `pattern` is the matchable string —
 * the bash command for runCommand, the workspace-relative file path for
 * editFile/writeFile — so rules like `"git *": "allow"` or `"*.env": "deny"`
 * can match it.
 */
export interface PermissionRequest {
  tool: ToolName; // "runCommand" | "editFile" | ...
  pattern: string; // e.g. the command, or the path
  title: string; // human summary shown in the prompt UI
  metadata?: Record<string, unknown>; // optional extra (cwd, replacements, ...)
}

/** A request that is currently awaiting a human answer. */
export interface PendingPermission extends PermissionRequest {
  id: string; // generateId(); key for reply()
}

/** The user's answer. `scope: "always"` persists the pattern for this project. */
export type PermissionDecision =
  | { type: "allow"; scope: "once" | "always" }
  | { type: "deny"; scope: "once" | "always"; feedback?: string };

/** A configured rule blocked the action outright (no prompt shown). */
export class PermissionDeniedError extends Error {
  override readonly name = "PermissionDeniedError";
}

/**
 * The user rejected the request. `feedback` is fed
 * back to the model as the tool result so it can self-correct.
 */
export class PermissionRejectedError extends Error {
  override readonly name = "PermissionRejectedError";
  constructor(
    message: string,
    readonly feedback?: string,
  ) {
    super(message);
  }
}
