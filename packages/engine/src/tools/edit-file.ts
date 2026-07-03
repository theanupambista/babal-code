import { readFile, stat, writeFile } from "node:fs/promises";
import { tool } from "ai";
import { z } from "zod";
import { getFileReadMtime, recordFileRead } from "../read-tracker";
import { resolveInWorkspace, toWorkspaceRelative, WorkspaceError } from "../workspace";

export const editFileTool = tool({
  description:
    "Replace an exact string in a file with another. `oldString` must match the file " +
    "verbatim (including whitespace) and, unless `replaceAll` is set, must be unique. You " +
    "must read the file first: editing a file that was never read, or one that changed on " +
    "disk since it was read, is rejected — read it (again) so the match reflects the " +
    "current contents.",
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

      const readAtMtime = getFileReadMtime(abs);
      if (readAtMtime === undefined) {
        return {
          error: `"${path}" has not been read yet. Use readFile before editing so the match reflects the current contents.`,
        };
      }
      const info = await stat(abs); // throws if the file was deleted — caught below.
      if (info.mtimeMs > readAtMtime) {
        return {
          error: `"${path}" has changed on disk since it was read (user, linter, or another tool). Read it again before editing.`,
        };
      }

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
      // Our own write bumps mtime; re-record so a follow-up edit this turn still passes.
      recordFileRead(abs, (await stat(abs)).mtimeMs);
      return { path: toWorkspaceRelative(abs), replacements: replaceAll ? occurrences : 1 };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
