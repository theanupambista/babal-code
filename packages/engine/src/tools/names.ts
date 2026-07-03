import type { ToolName } from "../modes";

/** Stable tool-name constants — sections import these, never raw strings. */
export const READ_FILE = "readFile" satisfies ToolName;
export const WRITE_FILE = "writeFile" satisfies ToolName;
export const EDIT_FILE = "editFile" satisfies ToolName;
export const LIST_DIRECTORY = "listDirectory" satisfies ToolName;
export const SEARCH_FILES = "searchFiles" satisfies ToolName;
export const GLOB = "glob" satisfies ToolName;
export const RUN_COMMAND = "runCommand" satisfies ToolName;
