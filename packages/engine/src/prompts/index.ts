import { joinSections } from "./format";
import { buildSystemPrompt } from "./builder";
import type { PromptContext } from "./types";

export type { PromptContext } from "./types";
export { buildSystemPrompt, buildStaticSystemPrompt } from "./builder";

/** Joined system prompt for the API — static sections only until dynamic registry exists. */
export function getSystemPrompt(ctx: PromptContext): string {
  return joinSections(buildSystemPrompt(ctx));
}
