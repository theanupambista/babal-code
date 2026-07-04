import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { ToolName } from "../modes";
import { configFile, permissionsFile, projectDir } from "../session/paths";
import type { PermissionAction } from "./types";

/** A rule value: a flat action, or per-pattern actions (last match wins). */
export type PermissionRuleValue =
  | PermissionAction
  | Record<string, PermissionAction>;

/**
 * The `permission` config block — keyed by tool name plus a "*" catch-all.
 * e.g.:
 *   { "*": "ask",
 *     "bash": { "*": "ask", "git *": "allow", "rm *": "deny" },
 *     "editFile":   { "*": "allow", "*.env": "deny" } }
 * Loaded from ~/.babalcode/config.json (the same file `config.ts` reads).
 */
export type PermissionConfig = Partial<
  Record<ToolName | "*", PermissionRuleValue>
>;

/**
 * Remembered "always allow/deny" decisions, project-scoped. Keyed by tool, then
 * by the *exact* pattern the user answered for (the literal command or path) —
 * unlike config rules these are not globbed, so an "always" answer applies only
 * to that precise action. Persisted at `<projectDir>/permissions.json`.
 */
export type RememberedDecisions = Partial<
  Record<ToolName, Record<string, PermissionAction>>
>;

/** Read the static `permission` rules from the global config. Missing/corrupt → {}. */
export async function loadPermissionConfig(): Promise<PermissionConfig> {
  try {
    const raw = JSON.parse(await readFile(configFile(), "utf8")) as {
      permission?: PermissionConfig;
    };
    return raw.permission ?? {};
  } catch {
    return {};
  }
}

/** Read this project's remembered "always" decisions. Missing/corrupt → {}. */
export async function loadRememberedDecisions(): Promise<RememberedDecisions> {
  try {
    return JSON.parse(
      await readFile(permissionsFile(), "utf8"),
    ) as RememberedDecisions;
  } catch {
    return {};
  }
}

/** Persist one "always" decision for this project (read-modify-write the JSON blob). */
export async function rememberDecision(
  tool: ToolName,
  pattern: string,
  action: PermissionAction,
): Promise<void> {
  const current = await loadRememberedDecisions();
  const next: RememberedDecisions = {
    ...current,
    [tool]: { ...(current[tool] ?? {}), [pattern]: action },
  };
  await mkdir(projectDir(), { recursive: true });
  await writeFile(
    permissionsFile(),
    `${JSON.stringify(next, null, 2)}\n`,
    "utf8",
  );
}
