import { editFileTool } from "./edit-file";
import { listDirectoryTool } from "./list-directory";
import { readFileTool } from "./read-file";
import { runCommandTool } from "./run-command";
import { searchFilesTool } from "./search-files";
import { writeFileTool } from "./write-file";

/**
 * The coding-agent toolset, spread into `streamText`'s `tools` in the chat route.
 * Each key becomes the `tool-<name>` UI part the CLI renders. To add a tool: create
 * `tools/<name>.ts` exporting a `tool(...)`, then add one line here — the route does
 * not change.
 */
export const codingTools = {
  readFile: readFileTool,
  writeFile: writeFileTool,
  editFile: editFileTool,
  listDirectory: listDirectoryTool,
  searchFiles: searchFilesTool,
  runCommand: runCommandTool,
};
