import { readFile, stat } from "node:fs/promises";
import { tool } from "ai";
import { z } from "zod";
import { resolveInWorkspace, toWorkspaceRelative, WorkspaceError } from "./workspace";

/** Refuse to slurp anything larger than this into the model context. */
const MAX_BYTES = 1_000_000;

export const readFileTool = tool({
  description:
    "Read a UTF-8 text file from the workspace. Optionally read a slice via 1-based " +
    "`offset` and `limit` line counts. Prefer this over guessing a file's contents.",
  inputSchema: z.object({
    path: z.string().describe("File path, relative to the workspace root."),
    offset: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("1-based line number to start reading from."),
    limit: z.number().int().positive().optional().describe("Maximum number of lines to read."),
  }),
  execute: async ({ path, offset, limit }) => {
    try {
      const abs = resolveInWorkspace(path);
      const info = await stat(abs);
      if (info.isDirectory()) return { error: `"${path}" is a directory, not a file.` };
      if (info.size > MAX_BYTES) {
        return { error: `"${path}" is ${info.size} bytes; too large to read (max ${MAX_BYTES}).` };
      }

      const content = await readFile(abs, "utf8");
      if (offset === undefined && limit === undefined) {
        return { path: toWorkspaceRelative(abs), content };
      }

      const lines = content.split("\n");
      const start = offset ? offset - 1 : 0;
      const end = limit ? start + limit : lines.length;
      return {
        path: toWorkspaceRelative(abs),
        content: lines.slice(start, end).join("\n"),
        totalLines: lines.length,
      };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
