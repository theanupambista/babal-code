import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import {
  resolveInWorkspace,
  toWorkspaceRelative,
  WORKSPACE_ROOT,
  WorkspaceError,
} from "../workspace";
import { runRipgrep, VCS_DIRECTORIES_TO_EXCLUDE } from "./ripgrep";

/**
 * Results are sorted by modification time (most recent first) across the *whole*
 * match set, and only then capped, so the newest files always survive the cap.
 */

/** Cap the number of files returned so a broad pattern does not flood the context. */
const MAX_RESULTS = 200;

export const globTool = tool({
  description:
    "Find files by glob pattern (e.g. '**/*.ts', 'src/**/*.test.ts'). Returns matching " +
    "file paths sorted by modification time, most recent first. Honours .gitignore and " +
    "skips .git. Use this to locate files by name or extension, not to search their contents.",
  inputSchema: z.object({
    pattern: z
      .string()
      .describe("A glob pattern to match file paths, e.g. '**/*.ts'."),
    path: z
      .string()
      .optional()
      .describe(
        "Directory to search within, relative to the workspace root. Defaults to the " +
          "workspace root. Omit this field to use the default — do not pass 'undefined' or 'null'.",
      ),
  }),
  execute: async ({ pattern, path: searchPath = "." }) => {
    // Resolve inside the workspace, then hand ripgrep a workspace-relative target
    // with cwd = WORKSPACE_ROOT so returned paths come back relative (and the
    // Windows drive-letter colon never confuses path parsing).
    let relTarget: string;
    try {
      relTarget = toWorkspaceRelative(resolveInWorkspace(searchPath));
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }

    // `--files` lists every (non-ignored) file; `--glob <pattern>` filters that
    // list to the requested pattern. `--hidden` still lets dotfiles match, while
    // gitignore rules and the explicit VCS excludes keep the noise out.
    const args = ["--files", "--hidden", "--glob", pattern];
    for (const dir of VCS_DIRECTORIES_TO_EXCLUDE)
      args.push("--glob", `!${dir}`);
    args.push(relTarget);

    let matches: string[];
    try {
      matches = await runRipgrep(args, WORKSPACE_ROOT);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }

    // Sort the full match set by mtime (most recent first) BEFORE capping, so the
    // cap drops the oldest files rather than whichever ones ripgrep happened to
    // list last. Ties break on path for a stable order.
    const withMtime = await Promise.all(
      matches.map(async (rel) => {
        try {
          const info = await Bun.file(path.join(WORKSPACE_ROOT, rel)).stat();
          return [rel, info.mtimeMs] as const;
        } catch {
          return [rel, 0] as const; // deleted between scan and stat — sort last
        }
      }),
    );
    withMtime.sort((a, b) => {
      const byTime = b[1] - a[1];
      return byTime !== 0 ? byTime : a[0].localeCompare(b[0]);
    });

    const truncated = withMtime.length > MAX_RESULTS;
    const files = withMtime.slice(0, MAX_RESULTS).map(([rel]) => rel);
    return { files, truncated };
  },
});
