/**
 * `@`-file mention detection and ranking for the prompt autocomplete.
 *
 * Where a slash command anchors at index 0 (see `commands.ts`), a file mention
 * can start anywhere in the input: whenever the user types `@` on a word
 * boundary, the menu opens over the workspace file list. This module owns the two
 * pure pieces — deciding whether the caret sits inside a live mention token
 * (`activeMention`) and ranking the file list against its query (`rankFiles`).
 * `ChatTextarea` drives the rest (loading files, navigation, insertion).
 */

/** A live mention token the caret is sitting at the end of. */
export type MentionMatch = {
  /** Character offset of the `@` in the text. */
  start: number;
  /** Character offset just past the query — i.e. the caret. */
  end: number;
  /** The (lowercased) query typed after `@`; empty right after `@`. */
  query: string;
};

/** Chars that terminate a mention token: whitespace and every quote flavour. */
const BREAK = /[\s'"`]/;

/**
 * If the caret sits at the end of a live `@`-mention token, return it; otherwise
 * `null`. A token qualifies when:
 *
 * - the `@` is at the start of the input or immediately follows whitespace — this
 *   is what rejects emails (`foo@bar`) and any `@` glued to a preceding word or
 *   an opening quote (`"@x`), so we never fire mid-identifier;
 * - every character between the `@` and the caret is a path character — no
 *   whitespace and no quote — so a quoted string or a second word closes it.
 *
 * We scan backwards from the caret so only the token the caret is *inside* is
 * considered; a completed mention earlier in the line is left alone.
 */
export function activeMention(text: string, caret: number): MentionMatch | null {
  // Walk back from the caret over path characters, stopping at the `@`.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i]!;
    if (ch === "@") break;
    if (BREAK.test(ch)) return null; // hit a boundary before any `@`
    i--;
  }
  if (i < 0 || text[i] !== "@") return null;

  // The char before `@` must be a boundary (start of text or whitespace), else
  // this `@` is part of a word — an email local part, a handle, a quoted literal.
  const prev = i > 0 ? text[i - 1]! : "";
  if (prev !== "" && !/\s/.test(prev)) return null;

  return { start: i, end: caret, query: text.slice(i + 1, caret).toLowerCase() };
}

/** The basename (last path segment) of a workspace-relative path. */
function basename(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return slash === -1 ? path : path.slice(slash + 1);
}

/**
 * Files whose path contains `query` (case-insensitive substring), ranked so the
 * most obvious hits surface first: a basename that *starts* with the query beats
 * one that merely contains it, which beats a match elsewhere in the path; ties
 * break on the shorter (shallower) path, then alphabetically. An empty query
 * keeps the input order. Result is capped to `limit` rows.
 */
export function rankFiles(files: readonly string[], query: string, limit: number): string[] {
  const q = query.toLowerCase();
  if (q === "") return files.slice(0, limit);

  const scored: { path: string; rank: number }[] = [];
  for (const path of files) {
    const lower = path.toLowerCase();
    if (!lower.includes(q)) continue;
    const base = basename(lower);
    const rank = base.startsWith(q) ? 0 : base.includes(q) ? 1 : 2;
    scored.push({ path, rank });
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    return a.path.localeCompare(b.path);
  });

  return scored.slice(0, limit).map((s) => s.path);
}
