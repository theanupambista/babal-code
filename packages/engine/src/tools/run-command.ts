import { tool } from "ai";
import { z } from "zod";
import { existsSync } from "node:fs";
import { permission } from "../permission";
import { toWorkspaceRelative, WORKSPACE_ROOT } from "../workspace";

/** Truncate captured output so a chatty command does not flood the model context. */
const MAX_OUTPUT = 30_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;

const IS_WINDOWS = process.platform === "win32";

/**
 * The directory the next command runs in. Each command spawns a fresh shell, so
 * a plain `cd` would be forgotten the instant that shell exits. We instead ask
 * every command to print where it ended up (see {@link buildShell}), read that
 * back, and remember it here — so `cd` persists across calls like a real
 * terminal. Only the directory is tracked; env vars / functions still reset.
 */
let currentCwd = WORKSPACE_ROOT;

/** Unlikely-to-collide marker the wrapped command uses to report its final cwd. */
const CWD_MARKER = "__BABAL_CWD__:";

/**
 * Locate a POSIX `bash`. We run every command through bash on all platforms so
 * command syntax is identical everywhere (like Claude Code) instead of using
 * `cmd` on Windows. On Windows that means Git for Windows' bash.exe; developers
 * almost always have Git installed. Resolution order: explicit override env var,
 * then the standard Git install locations, then whatever `bash` is on PATH.
 * Returns null on Windows when none is found, so the caller can tell the user.
 */
function resolveBash(): string | null {
  const override = process.env.BABALCODE_GIT_BASH_PATH;
  if (override) return override;

  if (IS_WINDOWS) {
    const candidates = [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files\\Git\\usr\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }
    // Last resort: PATH. (May resolve to WSL's bash.exe — the Git paths above
    // are tried first precisely to avoid that.)
    return Bun.which("bash");
  }

  return Bun.which("bash") ?? "/bin/bash";
}

let bashPathCache: string | null | undefined;
function bashPath(): string | null {
  if (bashPathCache === undefined) bashPathCache = resolveBash();
  return bashPathCache;
}

function clamp(text: string): string {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…[truncated]` : text;
}

/**
 * Pull the trailing cwd marker out of raw stdout. Must run on the *raw*, un-clamped
 * output — the marker is appended last, so truncation would otherwise eat it.
 */
function extractCwd(stdout: string): { cwd: string | null; cleaned: string } {
  const idx = stdout.lastIndexOf(CWD_MARKER);
  if (idx === -1) return { cwd: null, cleaned: stdout };

  const after = stdout.slice(idx + CWD_MARKER.length);
  const newlineIdx = after.indexOf("\n");
  const cwd = (newlineIdx === -1 ? after : after.slice(0, newlineIdx)).trim();

  // Drop the marker line (and the newline the shell printed before it) from stdout.
  const cleaned =
    stdout.slice(0, idx).replace(/\r?\n$/, "") +
    (newlineIdx === -1 ? "" : after.slice(newlineIdx + 1));

  return { cwd: cwd || null, cleaned };
}

/**
 * Wrap the user's command so that, after it runs, the shell prints its final
 * working directory on a marker line and exits with the command's own code.
 * On Windows Git Bash `pwd` reports a Unix-style path (`/e/…`) that Bun.spawn's
 * `cwd` can't consume, so we use `pwd -W` there to get the Windows form (`E:/…`).
 */
function buildShell(bash: string, command: string): string[] {
  const pwdExpr = IS_WINDOWS ? '"$(pwd -W)"' : '"$PWD"';
  const wrapped =
    `${command}\n` +
    `__babal_ec=$?\n` +
    `printf '${CWD_MARKER}%s\\n' ${pwdExpr}\n` +
    `exit $__babal_ec`;
  return [bash, "-c", wrapped];
}

export const runCommandTool = tool({
  description:
    "Run a shell command in bash (POSIX sh syntax on every platform, including " +
    "Windows via Git Bash). The working directory starts at the workspace root " +
    `(${toWorkspaceRelative(WORKSPACE_ROOT)}) and persists across calls: a \`cd\` in one ` +
    "command carries into the next, like a normal terminal. Environment variables and " +
    "shell functions do NOT persist. Returns stdout, stderr, exit code, and the current cwd.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to run (bash syntax)."),
    timeout: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        `Timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}, max ${MAX_TIMEOUT_MS}).`,
      ),
  }),
  execute: async ({ command, timeout }) => {
    const bash = bashPath();
    if (!bash) {
      return {
        error:
          "bash not found. Install Git for Windows (https://git-scm.com/download/win), " +
          "or set BABALCODE_GIT_BASH_PATH to your bash.exe.",
      };
    }

    try {
      // Gate the command on the permission broker before spawning. A denial throws
      // (PermissionDeniedError / PermissionRejectedError) and is caught below, becoming
      // the `{ error }` tool result the model sees and self-corrects from.
      await permission.ask({
        tool: "runCommand",
        pattern: command,
        title: `Run: ${command}`,
        metadata: { cwd: toWorkspaceRelative(currentCwd) },
      });

      const proc = Bun.spawn(buildShell(bash, command), {
        cwd: currentCwd,
        stdout: "pipe",
        stderr: "pipe",
      });

      const timeoutMs = Math.min(timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
      const timer = setTimeout(() => proc.kill(), timeoutMs);
      const [rawStdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      clearTimeout(timer);

      // Extract cwd from raw output before clamping (marker is at the very end).
      const { cwd, cleaned } = extractCwd(rawStdout);
      if (cwd) currentCwd = cwd;

      return {
        exitCode,
        stdout: clamp(cleaned),
        stderr: clamp(stderr),
        cwd: toWorkspaceRelative(currentCwd),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
