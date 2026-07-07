import { SyntaxStyle, type ThemeTokenStyle } from "@opentui/core";
import { colors } from "../../theme";

/**
 * Extra syntax hues used only for code-fence highlighting inside assistant
 * markdown. Kept out of the shared `colors` palette (which is UI chrome) — these
 * are a Tokyo Night code theme tuned to sit next to `colors.text`/`colors.muted`,
 * which are themselves Tokyo Night's fg/comment colors.
 */
const code = {
  keyword: "#bb9af7",
  fn: "#7aa2f7",
  type: "#7dcfff",
  number: "#ff9e64",
  string: colors.plan,
} as const;

/**
 * Style table for the OpenTUI `<markdown>` renderer. Covers two scope families:
 * the `markup.*` scopes it emits for markdown structure (headings, bold, links,
 * inline code…) and the Tree-sitter scopes emitted when highlighting fenced code
 * blocks. Unlisted scopes fall back to the `<markdown>` element's `fg`.
 */
const theme: ThemeTokenStyle[] = [
  // Markdown structure.
  { scope: ["markup.heading", "heading"], style: { foreground: colors.accent, bold: true } },
  { scope: ["markup.strong", "strong"], style: { foreground: colors.text, bold: true } },
  { scope: ["markup.italic"], style: { foreground: colors.text, italic: true } },
  { scope: ["markup.strikethrough", "del"], style: { foreground: colors.muted } },
  {
    scope: ["markup.link", "markup.link.url", "link"],
    style: { foreground: colors.accent, underline: true },
  },
  { scope: ["markup.link.label"], style: { foreground: colors.text } },
  { scope: ["markup.raw", "codespan"], style: { foreground: code.string } },
  { scope: ["blockquote"], style: { foreground: colors.muted, italic: true } },
  { scope: ["hr", "list", "list_item"], style: { foreground: colors.muted } },

  // Fenced code (Tree-sitter scopes).
  { scope: ["keyword", "keyword.control", "keyword.operator"], style: { foreground: code.keyword } },
  { scope: ["string", "string.special"], style: { foreground: code.string } },
  { scope: ["comment"], style: { foreground: colors.muted, italic: true } },
  {
    scope: ["function", "function.call", "function.method"],
    style: { foreground: code.fn },
  },
  { scope: ["type", "type.builtin", "constructor"], style: { foreground: code.type } },
  {
    scope: ["number", "constant", "constant.builtin", "boolean"],
    style: { foreground: code.number },
  },
  { scope: ["operator", "punctuation", "punctuation.delimiter"], style: { foreground: colors.muted } },
  { scope: ["variable", "property", "variable.member"], style: { foreground: colors.text } },
  { scope: ["tag", "attribute"], style: { foreground: code.keyword } },
];

/**
 * Lazily-built singleton. `SyntaxStyle` allocates through OpenTUI's native
 * render lib, so it must be created after the renderer is up — by the time any
 * assistant message renders, it is. Built once and shared across all messages.
 */
let cached: SyntaxStyle | undefined;
export function markdownSyntaxStyle(): SyntaxStyle {
  return (cached ??= SyntaxStyle.fromTheme(theme));
}
