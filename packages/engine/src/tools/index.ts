import { editFileTool } from "./edit-file";
import { globTool } from "./glob";
import { grepTool } from "./grep";
import { listDirectoryTool } from "./list-directory";
import { readFileTool } from "./read-file";
import { bashTool } from "./bash";
import { writeFileTool } from "./write-file";

/**
 * The coding-agent toolset, spread into `streamText`'s `tools` in the agent loop.
 * Each key becomes the `tool-<name>` UI part the CLI renders. To add a tool: create
 * `tools/<name>.ts` exporting a `tool(...)`, then add one line here — `agent.ts`
 * does not change.
 */
export const codingTools = {
  readFile: readFileTool,
  writeFile: writeFileTool,
  editFile: editFileTool,
  listDirectory: listDirectoryTool,
  grep: grepTool,
  glob: globTool,
  bash: bashTool,
};
