import { readFile, writeFile } from "node:fs/promises";
import { tool } from "ai";
import { z } from "zod";
import { resolveInWorkspace, toWorkspaceRelative, WorkspaceError } from "../workspace";

export const editFileTool = tool({
  description:
    "Replace an exact string in a file with another. `oldString` must match the file " +
    "verbatim (including whitespace) and, unless `replaceAll` is set, must be unique. Read " +
    "the file first so the match is exact.",
  inputSchema: z.object({
    path: z.string().describe("File path, relative to the workspace root."),
    oldString: z.string().describe("The exact text to replace."),
    newString: z.string().describe("The text to replace it with."),
    replaceAll: z
      .boolean()
      .optional()
      .describe("Replace every occurrence instead of requiring a unique match."),
  }),
  execute: async ({ path, oldString, newString, replaceAll }) => {
    try {
      const abs = resolveInWorkspace(path);
      const content = await readFile(abs, "utf8");

      const occurrences = content.split(oldString).length - 1;
      if (occurrences === 0) return { error: `\`oldString\` was not found in "${path}".` };
      if (occurrences > 1 && !replaceAll) {
        return {
          error: `\`oldString\` appears ${occurrences} times in "${path}"; make it unique or set replaceAll.`,
        };
      }

      const updated = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString);
      await writeFile(abs, updated, "utf8");
      return { path: toWorkspaceRelative(abs), replacements: replaceAll ? occurrences : 1 };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
