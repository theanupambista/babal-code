import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import { resolveInWorkspace, toWorkspaceRelative, WorkspaceError } from "../workspace";

export const writeFileTool = tool({
  description:
    "Create a new file or overwrite an existing one with the given contents. Parent " +
    "directories are created as needed. Use `editFile` for surgical changes to a large file.",
  inputSchema: z.object({
    path: z.string().describe("File path, relative to the workspace root."),
    content: z.string().describe("The full contents to write to the file."),
  }),
  execute: async ({ path: filePath, content }) => {
    try {
      const abs = resolveInWorkspace(filePath);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, content, "utf8");
      return { path: toWorkspaceRelative(abs), bytesWritten: Buffer.byteLength(content, "utf8") };
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }
  },
});
