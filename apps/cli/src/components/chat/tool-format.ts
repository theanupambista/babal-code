/**
 * Presentational formatting for tool-call parts — the single place that knows the
 * engine tools' input/output shapes (see `packages/engine/src/tools/`). Each tool
 * gets a `title` (the primary argument shown in the header) and a `body` (a compact
 * `count + preview` summary), instead of dumping raw `JSON.stringify(output)`.
 *
 * Formatters return the *full* summary string; `ToolMessage` truncates it for
 * display. Both entry points are defensive: during `input-streaming` the input is
 * partial, and unknown/dynamic tools fall back to first-arg / raw JSON.
 */

/** Coerce a loosely-typed part payload to an indexable record, or null. */
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

/** The header's primary argument (path, command, pattern…) for a tool call. */
type TitleFn = (input: Record<string, unknown>) => string;
/** A `count + preview` summary of a successful tool result. */
type BodyFn = (output: Record<string, unknown>) => string;

const TITLES: Record<string, TitleFn> = {
  readFile: (i) => str(i.path) ?? "",
  writeFile: (i) => str(i.path) ?? "",
  editFile: (i) => str(i.path) ?? "",
  listDirectory: (i) => `${str(i.path) ?? "."}${i.recursive ? " (recursive)" : ""}`,
  grep: (i) => {
    const pattern = str(i.pattern) ?? "";
    const scope = str(i.glob) ?? str(i.type) ?? str(i.path);
    return scope ? `'${pattern}' in ${scope}` : `'${pattern}'`;
  },
  bash: (i) => str(i.command) ?? "",
};

const BODIES: Record<string, BodyFn> = {
  readFile: (o) => {
    const content = str(o.content) ?? "";
    const lines = num(o.totalLines) ?? (content ? content.split("\n").length : 0);
    return content ? `${lines} lines\n${content}` : `${lines} lines`;
  },
  writeFile: (o) => `${num(o.bytesWritten) ?? 0} bytes written`,
  editFile: (o) => {
    const n = num(o.replacements) ?? 0;
    return `${n} replacement${n === 1 ? "" : "s"}`;
  },
  listDirectory: (o) => {
    const entries = Array.isArray(o.entries) ? o.entries : [];
    const names = entries.map((e) => {
      if (typeof e === "string") return e;
      const r = record(e);
      const name = str(r?.name) ?? "";
      return r?.type === "dir" ? `${name}/` : name;
    });
    const count = `${names.length}${o.truncated ? "+" : ""} entries`;
    return names.length ? `${count}\n${names.join("\n")}` : count;
  },
  grep: (o) => {
    const more = o.truncated ? "+" : "";
    if (o.mode === "content") {
      const content = str(o.content) ?? "";
      const count = `${num(o.numLines) ?? 0}${more} lines`;
      return content ? `${count}\n${content}` : count;
    }
    if (o.mode === "count") {
      const content = str(o.content) ?? "";
      const count = `${num(o.numMatches) ?? 0} matches in ${num(o.numFiles) ?? 0}${more} files`;
      return content ? `${count}\n${content}` : count;
    }
    // files_with_matches (default)
    const files = Array.isArray(o.filenames) ? o.filenames.map((f) => str(f) ?? "") : [];
    const count = `${files.length}${more} files`;
    return files.length ? `${count}\n${files.join("\n")}` : count;
  },
  bash: (o) => {
    const parts = [`exit ${num(o.exitCode) ?? 0}`];
    const stdout = str(o.stdout)?.trimEnd();
    const stderr = str(o.stderr)?.trimEnd();
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(stderr);
    return parts.join("\n");
  },
};

/** The primary argument to show in a tool call's header, e.g. the path or command. */
export function formatToolTitle(name: string, input: unknown): string {
  const rec = record(input);
  if (!rec) return "";
  const title = TITLES[name];
  if (title) return title(rec);
  // Unknown/dynamic tool: surface the first string argument, if any.
  const first = Object.values(rec).find((v) => typeof v === "string");
  return typeof first === "string" ? first : "";
}

/**
 * A compact summary of a tool result. The engine tools return `{ error }` as a
 * normal output object (they don't throw), so an error here means failure even
 * when the part's state is `output-available` — hence the `failed` flag.
 */
export function formatToolBody(name: string, output: unknown): { body: string; failed: boolean } {
  const rec = record(output);
  if (rec && "error" in rec) return { body: str(rec.error) ?? "failed", failed: true };
  if (!rec) return { body: "", failed: false };
  const body = BODIES[name];
  if (body) return { body: body(rec), failed: false };
  return { body: JSON.stringify(output), failed: false };
}
