import type { codingTools } from "./tools";

/**
 * Modes are named behavioural profiles. Each injects mode-specific instructions into
 * the system prompt and grants a subset of tools. `runAgent` resolves the active mode
 * per turn (like model selection) and applies both. To add a mode: append an entry to
 * `MODES` and widen `ModeId` — Tab-cycling, the footer, persistence, and tool filtering
 * all pick it up with no other changes.
 */

// Tool names a mode may allow — the keys of the codingTools registry.
export type ToolName = keyof typeof codingTools;

export type ModeId = "build" | "plan"; // widen as modes are added

export type Mode = {
  id: ModeId;
  label: string; // footer display, e.g. "Build"
  description: string; // one-liner (future /mode picker screen)
  instructions: string; // appended to the base system prompt ("" = base only)
  /** Allowed tools: "all" = every tool, or an explicit allowlist (default-deny). */
  tools: "all" | readonly ToolName[];
};

// Order defines the Tab cycle order.
export const MODES: readonly Mode[] = [
  {
    id: "build",
    label: "Build",
    description: "Full access — read, write, edit, and run commands.",
    instructions: "", // base system prompt already describes build behaviour
    tools: "all",
  },
  {
    id: "plan",
    label: "Plan",
    description:
      "Read-only. Investigate and propose a plan; do not modify the workspace.",
    instructions:
      "You are in PLAN mode. Do not modify the workspace: you have read-only tools only " +
      "(you cannot write files, edit files, or run commands). Investigate thoroughly, then " +
      "present a clear, step-by-step implementation plan for the user to review and approve. " +
      "If the user asks you to make changes, explain that they must switch to Build mode (Tab).",
    tools: ["readFile", "listDirectory", "grep", "glob"],
  },
] as const;

export const DEFAULT_MODE_ID: ModeId = "build";

/** Narrows an untrusted value (e.g. a transport body field) to a known `ModeId`. */
export function isModeId(value: unknown): value is ModeId {
  return MODES.some((m) => m.id === value);
}

/** The mode for `id`, falling back to the first (default) mode for unknown ids. */
export function getMode(id: string | undefined): Mode {
  return MODES.find((m) => m.id === id) ?? MODES[0]!;
}

/** Next mode id in cycle order (wraps). `dir` = -1 for reverse (Shift+Tab). */
export function getNextModeId(id: string, dir: 1 | -1 = 1): ModeId {
  const i = MODES.findIndex((m) => m.id === id);
  const base = i === -1 ? 0 : i;
  const next = (base + dir + MODES.length) % MODES.length;
  return MODES[next]!.id;
}
