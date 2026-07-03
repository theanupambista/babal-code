import { section } from "../format";
import type { PromptContext } from "../types";
import {
  EDIT_FILE,
  GLOB,
  GREP,
  LIST_DIRECTORY,
  READ_FILE,
  RUN_COMMAND,
  WRITE_FILE,
} from "../../tools/names";

/**
 * Mirrors Claude Code's `getUsingYourToolsSection`. babalcode maps Glob→glob and
 * Grep→grep, and adds a listDirectory bullet (no LS tool in Claude Code's
 * current prompt); it has no Task tool, so that bullet is dropped. Each
 * dedicated-tool bullet is gated on `enabledTools` so modes that restrict the
 * toolset (e.g. Plan) don't point at tools they lack.
 */
export function buildUsingToolsSection(ctx: PromptContext): string | null {
  const { enabledTools } = ctx;

  const providedToolSubitems: string[] = [];
  if (enabledTools.has(READ_FILE)) {
    providedToolSubitems.push(
      `To read files use ${READ_FILE} instead of cat, head, tail, or sed`,
    );
  }
  if (enabledTools.has(EDIT_FILE)) {
    providedToolSubitems.push(`To edit files use ${EDIT_FILE} instead of sed or awk`);
  }
  if (enabledTools.has(WRITE_FILE)) {
    providedToolSubitems.push(
      `To create files use ${WRITE_FILE} instead of cat with heredoc or echo redirection`,
    );
  }
  if (enabledTools.has(GLOB)) {
    providedToolSubitems.push(`To search for files use ${GLOB} instead of find or ls`);
  }
  if (enabledTools.has(GREP)) {
    providedToolSubitems.push(
      `To search the content of files, use ${GREP} instead of the grep or rg shell commands`,
    );
  }
  if (enabledTools.has(LIST_DIRECTORY)) {
    providedToolSubitems.push(
      `To list the contents of a directory use ${LIST_DIRECTORY} instead of ls`,
    );
  }

  const hasRunCommand = enabledTools.has(RUN_COMMAND);
  if (hasRunCommand && providedToolSubitems.length > 0) {
    providedToolSubitems.push(
      `Reserve using the ${RUN_COMMAND} exclusively for system commands and terminal operations that require shell execution. If you are unsure and there is a relevant dedicated tool, default to using the dedicated tool and only fallback on using the ${RUN_COMMAND} tool for these if it is absolutely necessary.`,
    );
  }

  const items: Array<string | string[]> = [];

  if (hasRunCommand && providedToolSubitems.length > 0) {
    items.push(
      `Do NOT use the ${RUN_COMMAND} to run commands when a relevant dedicated tool is provided. Using dedicated tools allows the user to better understand and review your work. This is CRITICAL to assisting the user:`,
    );
    items.push(providedToolSubitems);
  } else if (providedToolSubitems.length > 0) {
    items.push(...providedToolSubitems);
  }

  items.push(
    "You can call multiple tools in a single response. If you intend to call multiple tools and there are no dependencies between them, make all independent tool calls in parallel. Maximize use of parallel tool calls where possible to increase efficiency. However, if some tool calls depend on previous calls to inform dependent values, do NOT call these tools in parallel and instead call them sequentially. For instance, if one operation must complete before another starts, run these operations sequentially instead.",
  );

  return section("# Using your tools", items);
}
