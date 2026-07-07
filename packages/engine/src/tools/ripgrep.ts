import { dirname, join } from "node:path";
import { rgPath } from "@vscode/ripgrep";

/**
 * Shared ripgrep runner for the `grep` (content search) and `glob` (file search)
 * tools. Ripgrep is vendored via `@vscode/ripgrep` (a per-platform `rg` binary),
 * so both tools work out of the box with no system install; if that binary is
 * somehow unavailable we fall back to an `rg` on PATH.
 *
 * Release builds ship `rg` / `rg.exe` next to the compiled CLI binary; we check
 * that path first so standalone executables work without node_modules.
 */

/** Resolve the ripgrep binary once, lazily, preferring the vendored one. */
let cachedRgBinary: string | undefined;
async function resolveRgBinary(): Promise<string> {
  if (cachedRgBinary !== undefined) return cachedRgBinary;

  const sibling =
    process.platform === "win32"
      ? join(dirname(process.execPath), "rg.exe")
      : join(dirname(process.execPath), "rg");
  if (await Bun.file(sibling).exists()) {
    cachedRgBinary = sibling;
    return cachedRgBinary;
  }

  if (rgPath && (await Bun.file(rgPath).exists())) {
    cachedRgBinary = rgPath;
    return cachedRgBinary;
  }

  cachedRgBinary = "rg";
  return cachedRgBinary;
}

const RG_NOT_FOUND =
  "ripgrep could not be started. The vendored @vscode/ripgrep binary is missing " +
  "and no `rg` was found on PATH.";

/**
 * Run ripgrep and return its output lines. Exit code 0 (matches) and 1 (no
 * matches) are both success; anything else — including `rg` not being installed —
 * is thrown for the caller to turn into `{ error }`. Callers append their own
 * target path to `args`; `cwd` should be the workspace root so returned paths are
 * workspace-relative (this also strips ripgrep's leading `./` and CRLF endings).
 */
export async function runRipgrep(args: string[], cwd: string): Promise<string[]> {
  const rg = await resolveRgBinary();

  // Spawning a missing binary throws ENOENT synchronously.
  const proc = (() => {
    try {
      return Bun.spawn([rg, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
    } catch {
      return null;
    }
  })();
  if (!proc) throw new Error(RG_NOT_FOUND);

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0 && exitCode !== 1) {
    const detail = stderr.trim() || `ripgrep exited with code ${exitCode}`;
    if (detail.includes("ENOENT") || exitCode === null) throw new Error(RG_NOT_FOUND);
    throw new Error(detail);
  }

  return stdout
    .split("\n")
    .map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line))
    // When the target is ".", ripgrep prefixes every path with "./" (or ".\" on
    // Windows). Strip it so paths read like the other tools' output.
    .map((line) => line.replace(/^\.[/\\]/, ""))
    .filter(Boolean);
}

/** Version-control dirs excluded from every search — they only add noise. */
export const VCS_DIRECTORIES_TO_EXCLUDE = [
  ".git",
  ".svn",
  ".hg",
  ".bzr",
  ".jj",
  ".sl",
] as const;
