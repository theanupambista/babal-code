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
 * command syntax is identical everywhere instead of using
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
  return text.length > MAX_OUTPUT
    ? `${text.slice(0, MAX_OUTPUT)}\n…[truncated]`
    : text;
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

/**
 * Kill a timed-out command *and every process it spawned*. `proc.kill()` signals
 * only the top process — here the bash wrapper — so anything it launched (a dev
 * server, a compiler, a `sleep &`) keeps running, orphaned, after the timeout.
 * Bun.spawn exposes no detached/process-group option, so we tear the tree down by
 * PID: `taskkill /T` on Windows, and a `ps`-walked descendant sweep on POSIX.
 * Runs only on the (rare) timeout path, so the synchronous spawns are acceptable.
 */
function killProcessTree(proc: ReturnType<typeof Bun.spawn>): void {
  if (IS_WINDOWS) {
    // /T kills the whole tree rooted at the PID, /F forces termination.
    try {
      Bun.spawnSync(["taskkill", "/F", "/T", "/PID", String(proc.pid)]);
    } catch {
      // taskkill unavailable/failed — fall through to the single-process kill below.
    }
  } else {
    // Snapshot descendants *before* killing: signalling the parent reparents its
    // children (to init) but does not stop them, so we must enumerate them first.
    for (const child of posixDescendants(proc.pid)) {
      try {
        process.kill(child, "SIGKILL");
      } catch {
        // already exited
      }
    }
  }
  try {
    proc.kill("SIGKILL");
  } catch {
    // already exited
  }
}

/** Depth-first collect every descendant PID of `rootPid` from a `ps` snapshot (POSIX). */
function posixDescendants(rootPid: number): number[] {
  const snapshot =
    Bun.spawnSync(["ps", "-A", "-o", "pid=,ppid="]).stdout?.toString() ?? "";
  const childrenOf = new Map<number, number[]>();
  for (const line of snapshot.split("\n")) {
    const match = line.trim().match(/^(\d+)\s+(\d+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const ppid = Number(match[2]);
    const siblings = childrenOf.get(ppid);
    if (siblings) siblings.push(pid);
    else childrenOf.set(ppid, [pid]);
  }
  const descendants: number[] = [];
  const stack = [rootPid];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenOf.get(current) ?? []) {
      descendants.push(child);
      stack.push(child);
    }
  }
  return descendants;
}

export const bashTool = tool({
  description:
    "Run a shell command in bash (POSIX sh syntax on every platform, including " +
    "Windows via Git Bash). The working directory starts at the workspace root " +
    `(${toWorkspaceRelative(WORKSPACE_ROOT)}) and persists across calls: a \`cd\` in one ` +
    "command carries into the next, like a normal terminal. Environment variables and " +
    "shell functions do NOT persist. " +
    "Commands run non-interactively — there is no TTY and no background mode — so a command " +
    "that waits for input hangs until it times out and is then killed. Avoid interactive " +
    "commands (`git rebase -i`, `npm init` without flags, pagers, prompts) and long-running " +
    "foreground processes (a dev server, `watch`); pass non-interactive flags (e.g. `--yes`), " +
    "pipe input in, or append ` | cat` to defeat a pager. " +
    "Use POSIX sh syntax even on Windows: `/dev/null` not `NUL`, forward slashes in paths, " +
    '`$VAR` not `%VAR%`. Quote any path containing spaces (e.g. "C:/Program Files/app"). ' +
    "Returns stdout, stderr, exit code, the current cwd, " +
    "and `timedOut` (true if the command was killed for exceeding its timeout — its output " +
    "may be partial and its exit code reflects the kill, not the command itself).",
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
        tool: "bash",
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
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        killProcessTree(proc);
      }, timeoutMs);
      const [rawStdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      clearTimeout(timer);

      // Extract cwd from raw output before clamping (marker is at the very end).
      const { cwd, cleaned } = extractCwd(rawStdout);
      if (cwd) currentCwd = cwd;

      // On timeout the process was killed, so exitCode/stderr alone can't be
      // distinguished from an ordinary failure — flag it explicitly and note it
      // in stderr (where the model reads command failures) so it doesn't retry blindly.
      const timeoutNote = `[command exceeded its ${timeoutMs}ms timeout and was terminated, along with any processes it spawned; output may be partial]`;
      const finalStderr = timedOut
        ? stderr
          ? `${stderr}\n${timeoutNote}`
          : timeoutNote
        : stderr;

      return {
        exitCode,
        timedOut,
        stdout: clamp(cleaned),
        stderr: clamp(finalStderr),
        cwd: toWorkspaceRelative(currentCwd),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
