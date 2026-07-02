import { tool } from "ai";
import { z } from "zod";
import { toWorkspaceRelative, WORKSPACE_ROOT } from "../workspace";

/** Truncate captured output so a chatty command does not flood the model context. */
const MAX_OUTPUT = 30_000;
const DEFAULT_TIMEOUT_MS = 60_000;

function clamp(text: string): string {
  return text.length > MAX_OUTPUT ? `${text.slice(0, MAX_OUTPUT)}\n…[truncated]` : text;
}

export const runCommandTool = tool({
  description:
    "Run a shell command with the working directory pinned to the workspace root " +
    `(${toWorkspaceRelative(WORKSPACE_ROOT)}). Returns stdout, stderr, and the exit code. ` +
    "Note: the cwd is pinned, but a command can still reach outside the workspace via " +
    "absolute paths or `cd` — treat it as you would a normal shell.",
  inputSchema: z.object({
    command: z.string().describe("The shell command to run."),
    timeout: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(`Timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}).`),
  }),
  execute: async ({ command, timeout }) => {
    try {
      const shell =
        process.platform === "win32"
          ? ["cmd", "/c", command]
          : ["sh", "-c", command];
      const proc = Bun.spawn(shell, {
        cwd: WORKSPACE_ROOT,
        stdout: "pipe",
        stderr: "pipe",
      });

      const timer = setTimeout(() => proc.kill(), timeout ?? DEFAULT_TIMEOUT_MS);
      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);
      const exitCode = await proc.exited;
      clearTimeout(timer);

      return { exitCode, stdout: clamp(stdout), stderr: clamp(stderr) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
