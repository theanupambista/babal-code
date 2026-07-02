import { readdir } from "node:fs/promises";
import { tool } from "ai";
import { z } from "zod";
import { resolveInWorkspace, toWorkspaceRelative, WorkspaceError } from "./workspace";

/** Cap the number of entries returned so a huge tree does not flood the context. */
const MAX_ENTRIES = 500;

export const listDirectoryTool = tool({
  description:
    "List the contents of a directory in the workspace. Set `recursive` to walk the whole " +
    "subtree (skips node_modules and .git). Use this to discover the project layout.",
  inputSchema: z.object({
    path: z
      .string()
      .optional()
      .describe("Directory path relative to the workspace root. Defaults to the root."),
    recursive: z.boolean().optional().describe("Walk the entire subtree instead of one level."),
  }),
  execute: async ({ path = ".", recursive }) => {
    try {
      const abs = resolveInWorkspace(path);

      if (recursive) {
        const glob = new Bun.Glob("**/*");
        const entries: string[] = [];
        for await (const entry of glob.scan({ cwd: abs, onlyFiles: false })) {
          if (entry.startsWith("node_modules/") || entry.startsWith(".git/")) continue;
          entries.push(entry);
          if (entries.length >= MAX_ENTRIES) break;
        }
        return { path: toWorkspaceRelative(abs), entries, truncated: entries.length >= MAX_ENTRIES };
      }

      const dirents = await readdir(abs, { withFileTypes: true });
      const entries = dirents.map((d) => ({
        name: d.name,
        type: d.isDirectory() ? ("dir" as const) : ("file" as const),
      }));
      return { path: toWorkspaceRelative(abs), entries };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
