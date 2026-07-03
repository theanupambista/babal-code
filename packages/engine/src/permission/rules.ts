import type { ToolName } from "../modes";
import type {
  PermissionConfig,
  PermissionRuleValue,
  RememberedDecisions,
} from "./store";
import type { PermissionAction, PermissionRequest } from "./types";

/** Read-only tools default to `allow`; everything else (mutating) defaults to `ask`. */
const READ_ONLY_TOOLS: ReadonlySet<ToolName> = new Set([
  "readFile",
  "listDirectory",
  "grep",
  "glob",
]);

function defaultAction(tool: ToolName): PermissionAction {
  return READ_ONLY_TOOLS.has(tool) ? "allow" : "ask";
}

/** Compile a shell-style glob (`*` = any, `?` = one char) to an anchored RegExp. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex metachars (not * or ?)
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}

function globMatch(glob: string, value: string): boolean {
  if (glob === "*") return true; // fast path for the catch-all
  return globToRegExp(glob).test(value);
}

/** Every action whose glob matches `pattern`, in declaration order (for last-match-wins). */
function matchesFor(
  value: PermissionRuleValue | undefined,
  pattern: string,
): PermissionAction[] {
  if (value === undefined) return [];
  if (typeof value === "string") return [value];
  const out: PermissionAction[] = [];
  for (const [glob, action] of Object.entries(value)) {
    if (globMatch(glob, pattern)) out.push(action);
  }
  return out;
}

/**
 * Pure, synchronous rule check:
 *   1. any matching config `deny`  → "deny"   (deny always wins)
 *   2. explicit config `allow`/`ask` → last match wins (a specific later rule
 *      overrides a broader `"*"`; the "*" catch-all block is considered first,
 *      then the tool-specific block)
 *   3. remembered "always" decision for this project (exact pattern)
 *   4. per-tool default (read-only → allow, mutating → ask)
 */
export function evaluate(
  req: PermissionRequest,
  config: PermissionConfig,
  remembered: RememberedDecisions,
): PermissionAction {
  const { tool, pattern } = req;
  const matches = [
    ...matchesFor(config["*"], pattern),
    ...matchesFor(config[tool], pattern),
  ];

  if (matches.includes("deny")) return "deny";

  // Last explicit allow/ask wins. An explicit "ask" forces a prompt, ignoring any
  // remembered decision — the user asked to always be consulted for this pattern.
  const last = [...matches].reverse().find((a) => a === "allow" || a === "ask");
  if (last) return last;

  const remembered_ = remembered[tool]?.[pattern];
  if (remembered_) return remembered_;

  return defaultAction(tool);
}
