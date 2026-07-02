import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { resolveInWorkspace, toWorkspaceRelative, WorkspaceError } from "./workspace";

const MAX_MATCHES = 200;
const MAX_FILE_BYTES = 1_000_000;

export const searchFilesTool = tool({
  description:
    "Search file contents across the workspace with a regular expression (grep-like). " +
    "Returns matching lines with their file and 1-based line number. Skips node_modules, " +
    ".git, and large/binary files.",
  inputSchema: z.object({
    pattern: z.string().describe("A regular expression to match against each line."),
    path: z
      .string()
      .optional()
      .describe("Directory to search within, relative to the workspace root. Defaults to root."),
    glob: z
      .string()
      .optional()
      .describe("Glob to limit which files are searched, e.g. '**/*.ts'. Defaults to '**/*'."),
  }),
  execute: async ({ pattern, path: searchPath = ".", glob = "**/*" }) => {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch {
      return { error: `Invalid regular expression: ${pattern}` };
    }

    try {
      const root = resolveInWorkspace(searchPath);
      const matches: { file: string; line: number; text: string }[] = [];
      let truncated = false;

      outer: for await (const rel of new Bun.Glob(glob).scan({ cwd: root })) {
        if (rel.startsWith("node_modules/") || rel.startsWith(".git/")) continue;
        const abs = path.join(root, rel);
        try {
          const info = await stat(abs);
          if (info.size > MAX_FILE_BYTES) continue;
          const buffer = await readFile(abs);
          if (buffer.includes(0)) continue; // skip binary files (contain a NUL byte)
          const lines = buffer.toString("utf8").split("\n");
          for (let i = 0; i < lines.length; i++) {
            const text = lines[i] ?? "";
            if (regex.test(text)) {
              matches.push({ file: toWorkspaceRelative(abs), line: i + 1, text });
              if (matches.length >= MAX_MATCHES) {
                truncated = true;
                break outer;
              }
            }
          }
        } catch {
          continue; // unreadable file — skip
        }
      }

      return { matches, truncated };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
