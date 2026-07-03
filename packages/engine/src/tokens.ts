import { decode, encode } from "gpt-tokenizer"; // default cl100k_base encoding

/**
 * Local BPE token counting, used as a size guard on tool output (see `read-file.ts`).
 * The engine is provider-agnostic, so this is an approximation of any given model's
 * tokenizer — good enough to bound how much a single tool result can flood context.
 */
export function countTokens(text: string): number {
  return encode(text).length;
}

/** Truncate `text` to at most `maxTokens` tokens (BPE-approximate). */
export function truncateToTokens(
  text: string,
  maxTokens: number,
): { text: string; truncated: boolean } {
  const tokens = encode(text);
  if (tokens.length <= maxTokens) return { text, truncated: false };
  return { text: decode(tokens.slice(0, maxTokens)), truncated: true };
}
