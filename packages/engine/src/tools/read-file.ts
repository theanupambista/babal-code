import { readFile, stat } from "node:fs/promises";
import { tool } from "ai";
import { z } from "zod";
import { recordFileRead } from "../read-tracker";
import { truncateToTokens } from "../tokens";
import { resolveInWorkspace, toWorkspaceRelative, WorkspaceError } from "../workspace";

/**
 * Limits mirror Claude Code's Read tool so the model sees a familiar contract:
 * a byte cap on the file, a default line window, a per-line character cap, and a
 * token cap on the numbered output (counted with a real tokenizer, see `tokens.ts`).
 */
const MAX_BYTES = 256 * 1024; // 256 KB file-size cap
const DEFAULT_LIMIT = 2000; // lines read when `limit` is omitted
const MAX_LINE_LENGTH = 2000; // characters kept per line before truncating
const MAX_OUTPUT_TOKENS = 25_000; // token budget for the numbered output

/** Format one line the way `cat -n` does: right-aligned number, tab, content. */
function numberLine(lineNo: number, text: string): string {
  const clipped =
    text.length > MAX_LINE_LENGTH ? `${text.slice(0, MAX_LINE_LENGTH)}… [line truncated]` : text;
  return `${String(lineNo).padStart(6, " ")}\t${clipped}`;
}

export const readFileTool = tool({
  description:
    "Read a UTF-8 text file from the workspace. Output is line-numbered in `cat -n` " +
    "format (a right-aligned line number, a tab, then the line). Reads up to 2000 lines " +
    "by default; use 1-based `offset`/`limit` to read a specific slice of a larger file. " +
    "Prefer this over guessing a file's contents.",
  inputSchema: z.object({
    path: z.string().describe("File path, relative to the workspace root."),
    offset: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("1-based line number to start reading from."),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of lines to read (default 2000)."),
  }),
  execute: async ({ path, offset, limit }) => {
    try {
      const abs = resolveInWorkspace(path);
      const info = await stat(abs);
      if (info.isDirectory()) return { error: `"${path}" is a directory, not a file.` };
      if (info.size > MAX_BYTES) {
        return {
          error: `"${path}" is ${info.size} bytes; too large to read (max ${MAX_BYTES}). Use offset/limit to read a slice, or search the file instead.`,
        };
      }

      const raw = await readFile(abs, "utf8");
      const rel = toWorkspaceRelative(abs);
      // Mark the file read (with its current mtime) so `editFile` can require a prior
      // read and detect out-of-band changes. A partial (offset/limit) read still counts.
      recordFileRead(abs, info.mtimeMs);

      if (raw === "") {
        return {
          path: rel,
          content: "<system-reminder>Warning: the file exists but has empty contents.</system-reminder>",
          totalLines: 0,
        };
      }

      const allLines = raw.split("\n");
      const start = offset ? offset - 1 : 0;
      const end = start + (limit ?? DEFAULT_LIMIT);
      const numbered = allLines
        .slice(start, end)
        .map((line, i) => numberLine(start + i + 1, line))
        .join("\n");

      const { text, truncated } = truncateToTokens(numbered, MAX_OUTPUT_TOKENS);
      let content = text;
      if (truncated) {
        // decode may cut mid-line; trim back to the last newline for clean output.
        content = content.slice(0, content.lastIndexOf("\n") + 1 || content.length);
        content += `\n<system-reminder>Output truncated at ${MAX_OUTPUT_TOKENS} tokens. Use offset/limit to read the rest.</system-reminder>`;
      }

      return { path: rel, content, totalLines: allLines.length };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
