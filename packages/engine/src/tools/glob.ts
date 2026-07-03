import { stat } from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { resolveInWorkspace, toWorkspaceRelative, WorkspaceError } from "../workspace";

/** Cap the number of files returned so a broad pattern does not flood the context. */
const MAX_RESULTS = 200;

export const globTool = tool({
  description:
    "Find files by glob pattern (e.g. '**/*.ts', 'src/**/*.test.ts'). Returns matching " +
    "file paths sorted by modification time, most recent first. Skips node_modules and " +
    ".git. Use this to locate files by name or extension, not to search their contents.",
  inputSchema: z.object({
    pattern: z.string().describe("A glob pattern to match file paths, e.g. '**/*.ts'."),
    path: z
      .string()
      .optional()
      .describe("Directory to search within, relative to the workspace root. Defaults to root."),
  }),
  execute: async ({ pattern, path: searchPath = "." }) => {
    try {
      const root = resolveInWorkspace(searchPath);
      const found: { file: string; mtimeMs: number }[] = [];
      let truncated = false;

      for await (const rel of new Bun.Glob(pattern).scan({ cwd: root })) {
        if (rel.startsWith("node_modules/") || rel.startsWith(".git/")) continue;
        const abs = path.join(root, rel);
        try {
          const info = await stat(abs);
          found.push({ file: toWorkspaceRelative(abs), mtimeMs: info.mtimeMs });
        } catch {
          continue; // stat failed (e.g. broken symlink) — skip
        }
        if (found.length >= MAX_RESULTS) {
          truncated = true;
          break;
        }
      }

      found.sort((a, b) => b.mtimeMs - a.mtimeMs);
      return { files: found.map((f) => f.file), truncated };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
