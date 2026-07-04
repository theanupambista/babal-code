import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { permission } from "../permission";
import { getFileReadMtime, recordFileRead } from "../read-tracker";
import {
  resolveInWorkspace,
  toWorkspaceRelative,
  WorkspaceError,
} from "../workspace";

export const writeFileTool = tool({
  description:
    "Create a new file or overwrite an existing one with the given contents. Parent " +
    "directories are created as needed. Overwriting an existing file requires reading it " +
    "first (and re-reading if it changed on disk since). Use `editFile` for surgical " +
    "changes to a large file.",
  inputSchema: z.object({
    path: z.string().describe("File path, relative to the workspace root."),
    content: z.string().describe("The full contents to write to the file."),
  }),
  execute: async ({ path: filePath, content }) => {
    try {
      const abs = resolveInWorkspace(filePath);

      // Overwriting an existing file goes through the same gates as `editFile`: it must
      // have been read first, and not have changed on disk since. Creating a new file
      // (stat throws ENOENT) skips both — there is nothing to blindly clobber.
      const existing = await stat(abs).catch(() => undefined);
      if (existing?.isFile()) {
        const readAtMtime = getFileReadMtime(abs);
        if (readAtMtime === undefined) {
          return {
            error: `"${filePath}" already exists but has not been read yet. Use readFile before overwriting so you don't discard contents you haven't seen.`,
          };
        }
        if (existing.mtimeMs > readAtMtime) {
          return {
            error: `"${filePath}" has changed on disk since it was read (user, linter, or another tool). Read it again before overwriting.`,
          };
        }
      }

      // Gate on the permission broker before touching disk (a denial throws and
      // becomes the `{ error }` result the model self-corrects from).
      const rel = toWorkspaceRelative(abs);
      await permission.ask({
        tool: "writeFile",
        pattern: rel,
        title: `Write ${rel}`,
      });

      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf8");
      // Treat a written file as read so a later `editFile` isn't
      // blocked by the never-read gate.
      recordFileRead(abs, (await stat(abs)).mtimeMs);
      return {
        path: toWorkspaceRelative(abs),
        bytesWritten: Buffer.byteLength(content, "utf8"),
      };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
