import path from "node:path";

/**
 * The single sandbox root every file tool is confined to. This is the process's
 * current working directory, captured once at module load — the agent is meant
 * to be launched from the directory it should work
 * in, so `cwd` *is* "the current directory". `WORKSPACE_ROOT` env is honored as a
 * test-only override; it is intentionally not a documented `.env` setting.
 */
export const WORKSPACE_ROOT = path.resolve(
  process.env.WORKSPACE_ROOT ?? process.cwd(),
);

/** Thrown when a tool is asked to touch a path outside {@link WORKSPACE_ROOT}. */
export class WorkspaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceError";
  }
}

/**
 * Resolve a user/model-supplied path to an absolute path and assert it stays
 * inside the workspace. Relative paths join `WORKSPACE_ROOT`; absolute paths are
 * taken as-is. Any resolved path that escapes the root (via `..`, or an absolute
 * path elsewhere) throws {@link WorkspaceError}.
 *
 * This is a lexical (path-based) guard — it does not follow symlinks, so it
 * defends against path traversal but not against a symlink already inside the
 * workspace pointing out of it.
 */
export function resolveInWorkspace(relOrAbs: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, relOrAbs);
  // Compare against `root + sep` so `/foobar` is not accepted as being inside
  // `/foo`. The root itself is also allowed.
  if (
    resolved !== WORKSPACE_ROOT &&
    !resolved.startsWith(WORKSPACE_ROOT + path.sep)
  ) {
    throw new WorkspaceError(
      `Path "${relOrAbs}" is outside the workspace and cannot be accessed.`,
    );
  }
  return resolved;
}

/** Render an absolute path back as workspace-relative for human-readable output. */
export function toWorkspaceRelative(abs: string): string {
  const rel = path.relative(WORKSPACE_ROOT, abs);
  return rel === "" ? "." : rel;
}
