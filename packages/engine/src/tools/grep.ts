import path from "node:path";
import { tool } from "ai";
import { z } from "zod";
import {
  resolveInWorkspace,
  toWorkspaceRelative,
  WORKSPACE_ROOT,
  WorkspaceError,
} from "../workspace";
import { runRipgrep, VCS_DIRECTORIES_TO_EXCLUDE } from "./ripgrep";

const DEFAULT_HEAD_LIMIT = 250;

/** Optional number that also accepts a numeric string (models sometimes send "3"). */
const optNumber = z.coerce.number().optional();
/** Optional boolean that also accepts the strings "true"/"false". */
const optBool = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => v === true || v === "true")
  .optional();

function applyHeadLimit<T>(
  items: T[],
  limit: number | undefined,
  offset: number,
): { items: T[]; appliedLimit: number | undefined } {
  // Explicit 0 = unlimited escape hatch.
  if (limit === 0)
    return { items: items.slice(offset), appliedLimit: undefined };
  const effectiveLimit = limit ?? DEFAULT_HEAD_LIMIT;
  const sliced = items.slice(offset, offset + effectiveLimit);
  // Only report appliedLimit when truncation actually happened, so the model
  // knows there may be more and can paginate with offset.
  const wasTruncated = items.length - offset > effectiveLimit;
  return {
    items: sliced,
    appliedLimit: wasTruncated ? effectiveLimit : undefined,
  };
}

export const grepTool = tool({
  description: `A powerful search tool built on ripgrep

  Usage:
  - ALWAYS use the grep tool for search tasks. NEVER invoke \`grep\` or \`rg\` with the bash tool; the grep tool is optimized for correct permissions and access.
  - Supports full regex syntax (e.g., "log.*Error", "function\\s+\\w+")
  - Filter files with the glob parameter (e.g., "*.js", "**/*.tsx") or the type parameter (e.g., "js", "py", "rust")
  - Output modes: "content" shows matching lines, "files_with_matches" shows only file paths (default), "count" shows match counts
  - Pattern syntax: Uses ripgrep (not grep) — literal braces need escaping (use \`interface\\{\\}\` to find \`interface{}\` in Go code)
  - Multiline matching: By default patterns match within single lines only. For cross-line patterns like \`struct \\{[\\s\\S]*?field\`, use \`multiline: true\``,
  inputSchema: z.object({
    pattern: z
      .string()
      .describe(
        "The regular expression pattern to search for in file contents",
      ),
    path: z
      .string()
      .optional()
      .describe(
        "File or directory to search in, relative to the workspace root. Defaults to the workspace root.",
      ),
    glob: z
      .string()
      .optional()
      .describe(
        'Glob pattern to filter files (e.g. "*.js", "*.{ts,tsx}") — maps to rg --glob',
      ),
    type: z
      .string()
      .optional()
      .describe(
        "File type to search (rg --type). Common types: js, py, rust, go, java, etc. More efficient than glob for standard file types.",
      ),
    output_mode: z
      .enum(["content", "files_with_matches", "count"])
      .optional()
      .describe(
        'Output mode: "content" shows matching lines (supports -A/-B/-C context, -n line numbers, head_limit), "files_with_matches" shows file paths (supports head_limit), "count" shows match counts. Defaults to "files_with_matches".',
      ),
    "-B": optNumber.describe(
      'Number of lines to show before each match (rg -B). Requires output_mode: "content", ignored otherwise.',
    ),
    "-A": optNumber.describe(
      'Number of lines to show after each match (rg -A). Requires output_mode: "content", ignored otherwise.',
    ),
    "-C": optNumber.describe(
      'Number of lines to show before and after each match (rg -C). Requires output_mode: "content", ignored otherwise.',
    ),
    "-n": optBool.describe(
      'Show line numbers in output (rg -n). Requires output_mode: "content", ignored otherwise. Defaults to true.',
    ),
    "-i": optBool.describe("Case insensitive search (rg -i)"),
    multiline: optBool.describe(
      "Enable multiline mode where . matches newlines and patterns can span lines (rg -U --multiline-dotall). Default: false.",
    ),
    head_limit: optNumber.describe(
      'Limit output to first N lines/entries, equivalent to "| head -N". Works across all output modes. Defaults to 250 when unspecified. Pass 0 for unlimited.',
    ),
    offset: optNumber.describe(
      'Skip first N lines/entries before applying head_limit, equivalent to "| tail -n +N | head -N". Defaults to 0.',
    ),
  }),
  execute: async (input) => {
    const {
      pattern,
      path: searchPath = ".",
      glob,
      type,
      output_mode = "files_with_matches",
      "-B": contextBefore,
      "-A": contextAfter,
      "-C": contextC,
      "-n": showLineNumbers = true,
      "-i": caseInsensitive = false,
      multiline = false,
      head_limit,
      offset = 0,
    } = input;

    // Resolve inside the workspace, then pass ripgrep a workspace-relative target
    // with cwd = WORKSPACE_ROOT so its output paths come back relative (and the
    // Windows drive-letter colon never confuses path parsing).
    let relTarget: string;
    try {
      relTarget = toWorkspaceRelative(resolveInWorkspace(searchPath));
    } catch (error) {
      if (error instanceof WorkspaceError) return { error: error.message };
      return { error: error instanceof Error ? error.message : String(error) };
    }

    const args = ["--hidden"];
    // Exclude VCS metadata directories.
    for (const dir of VCS_DIRECTORIES_TO_EXCLUDE)
      args.push("--glob", `!${dir}`);
    // Keep base64/minified lines from cluttering output.
    args.push("--max-columns", "500");

    if (multiline) args.push("-U", "--multiline-dotall");
    if (caseInsensitive) args.push("-i");

    if (output_mode === "files_with_matches") args.push("-l");
    else if (output_mode === "count") args.push("-c");

    if (showLineNumbers && output_mode === "content") args.push("-n");

    // Context flags only apply to content mode; -C wins over -B/-A.
    if (output_mode === "content") {
      if (contextC !== undefined) {
        args.push("-C", String(contextC));
      } else {
        if (contextBefore !== undefined) args.push("-B", String(contextBefore));
        if (contextAfter !== undefined) args.push("-A", String(contextAfter));
      }
    }

    // A leading dash would be read as a flag; pass it explicitly with -e.
    if (pattern.startsWith("-")) args.push("-e", pattern);
    else args.push(pattern);

    if (type) args.push("--type", type);

    if (glob) {
      // Split on whitespace/commas, but keep brace patterns like "*.{ts,tsx}" intact.
      const globPatterns: string[] = [];
      for (const raw of glob.split(/\s+/)) {
        if (raw.includes("{") && raw.includes("}")) globPatterns.push(raw);
        else globPatterns.push(...raw.split(",").filter(Boolean));
      }
      for (const g of globPatterns.filter(Boolean)) args.push("--glob", g);
    }

    // Target path is the last positional; ripgrep emits paths relative to
    // WORKSPACE_ROOT (our cwd + relative target).
    args.push(relTarget);
    let results: string[];
    try {
      results = await runRipgrep(args, WORKSPACE_ROOT);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }

    if (output_mode === "content") {
      const { items, appliedLimit } = applyHeadLimit(
        results,
        head_limit,
        offset,
      );
      return {
        mode: "content" as const,
        content: items.join("\n"),
        numLines: items.length,
        truncated: appliedLimit !== undefined,
      };
    }

    if (output_mode === "count") {
      const { items, appliedLimit } = applyHeadLimit(
        results,
        head_limit,
        offset,
      );
      let numMatches = 0;
      let numFiles = 0;
      for (const line of items) {
        // Count-mode lines are `relative/path:count`; the count is after the last colon.
        const count = Number.parseInt(
          line.slice(line.lastIndexOf(":") + 1),
          10,
        );
        if (!Number.isNaN(count)) {
          numMatches += count;
          numFiles += 1;
        }
      }
      return {
        mode: "count" as const,
        content: items.join("\n"),
        numMatches,
        numFiles,
        truncated: appliedLimit !== undefined,
      };
    }

    // files_with_matches (default): sort by mtime (most recent first) like ripgrep.
    const withMtime = await Promise.all(
      results.map(async (rel) => {
        try {
          const info = await Bun.file(path.join(WORKSPACE_ROOT, rel)).stat();
          return [rel, info.mtimeMs] as const;
        } catch {
          return [rel, 0] as const; // deleted between scan and stat — sort last
        }
      }),
    );
    withMtime.sort((a, b) => {
      const byTime = b[1] - a[1];
      return byTime !== 0 ? byTime : a[0].localeCompare(b[0]);
    });
    const sorted = withMtime.map(([rel]) => rel);

    const { items, appliedLimit } = applyHeadLimit(sorted, head_limit, offset);
    return {
      mode: "files_with_matches" as const,
      filenames: items,
      numFiles: items.length,
      truncated: appliedLimit !== undefined,
    };
  },
});
