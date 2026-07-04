import type { ToolUIPart } from "ai";
import type { ReactNode } from "react";
import { useContext } from "react";
import { colors } from "../../theme";
import { EmptyBorder } from "../border";
import { ToolSelectionContext } from "./tool-selection";

/** Collapsed tool output shows at most this many lines before truncating. */
const TOOL_BODY_CAP = 8;

/**
 * Every message's body text starts this many columns from the left, so the prompt
 * input, user, assistant, tool and reasoning text all line up vertically. Bordered
 * variants (user/tool/reasoning, and the prompt input) spend their first column on
 * the ┃ bar, so they pad by `BAR_CONTENT_PADDING`; borderless assistant text pads by
 * the full `TEXT_INSET`. Keep the prompt input's padding in sync via the export.
 */
export const TEXT_INSET = 4;
export const BAR_CONTENT_PADDING = TEXT_INSET - 1;

/**
 * A message authored by the human — styled like the prompt input panel. The
 * colored left bar (no label) marks it as user-sent; `color` tints that bar to
 * the mode the message was sent in.
 */
export function UserMessage({
  children,
  color = colors.accent,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <box flexDirection="row" flexShrink={0} width="100%">
      <box
        border={["left"]}
        borderColor={color}
        customBorderChars={{ ...EmptyBorder, vertical: "┃" }}
      />
      <box
        backgroundColor={colors.panel}
        paddingX={BAR_CONTENT_PADDING}
        paddingY={1}
        flexDirection="column"
        flexGrow={1}
      >
        <text fg={colors.text}>{children}</text>
      </box>
    </box>
  );
}

/**
 * A message authored by the assistant — plain text, no label, no border. Indented
 * by `TEXT_INSET` so it lines up with the bordered messages and the prompt input.
 */
export function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <box paddingLeft={TEXT_INSET} width="100%">
      <text fg={colors.text}>{children}</text>
    </box>
  );
}

/**
 * A colored left bar next to indented content — the display used by the prompt
 * input and user messages. Tool calls and reasoning reuse it so they read as
 * secondary annotations, keeping the eye on the plain assistant text.
 */
function SidebarMessage({
  children,
  color = colors.muted,
  id,
}: {
  children: ReactNode;
  color?: string;
  /** Renderable id, so the scrollbox can `scrollChildIntoView` this message. */
  id?: string;
}) {
  return (
    <box id={id} flexDirection="row" flexShrink={0} width="100%">
      <box
        border={["left"]}
        borderColor={color}
        customBorderChars={{ ...EmptyBorder, vertical: "┃" }}
      />
      <box paddingX={BAR_CONTENT_PADDING} flexDirection="column" flexGrow={1}>
        {children}
      </box>
    </box>
  );
}

/** Human-readable status for each tool-call state. */
const TOOL_STATUS: Record<ToolUIPart["state"], string> = {
  "input-streaming": "calling…",
  "input-available": "running…",
  "approval-requested": "awaiting approval",
  "approval-responded": "approved",
  "output-available": "done",
  "output-error": "failed",
  "output-denied": "denied",
};

/**
 * A tool call: a header (`name · primary-arg · status`) above a compact summary,
 * behind a dimmed left bar so it reads as a secondary annotation next to the
 * assistant's plain text. The bar and header brighten to the accent color when
 * this call is selected (ctrl+↑/↓ in the chat screen).
 *
 * `detail` is the summary body. Collapsed calls show at most `TOOL_BODY_CAP`
 * lines with a `… +N more` hint; expanding the selected call (ctrl+r) shows the
 * whole thing. `failed` turns the bar and body red — note the engine tools
 * report errors as normal output, so failures can arrive in a non-error state.
 */
export function ToolMessage({
  toolId,
  name,
  state,
  title,
  detail,
  failed = false,
}: {
  toolId: string;
  name: string;
  state: ToolUIPart["state"];
  title?: string;
  detail?: string;
  failed?: boolean;
}) {
  const { selectedId, expandedIds } = useContext(ToolSelectionContext);
  const selected = selectedId === toolId;
  const expanded = expandedIds.has(toolId);

  const barColor = failed ? colors.danger : selected ? colors.accent : colors.muted;
  const headerColor = selected ? colors.accent : colors.muted;
  const bodyColor = failed ? colors.danger : colors.muted;

  const header = title
    ? `${name} · ${title} · ${TOOL_STATUS[state]}`
    : `${name} · ${TOOL_STATUS[state]}`;

  const lines = detail ? detail.split("\n") : [];
  const hidden = !expanded && lines.length > TOOL_BODY_CAP ? lines.length - TOOL_BODY_CAP : 0;
  const shown = hidden ? lines.slice(0, TOOL_BODY_CAP) : lines;

  return (
    <SidebarMessage color={barColor} id={toolId}>
      <text fg={headerColor}>{header}</text>
      {shown.length > 0 && <text fg={bodyColor}>{shown.join("\n")}</text>}
      {hidden > 0 && (
        <text fg={colors.muted}>
          … +{hidden} more {hidden === 1 ? "line" : "lines"} (ctrl+r to expand)
        </text>
      )}
    </SidebarMessage>
  );
}

/**
 * The assistant's intermediate reasoning — dimmed and italic behind a muted left
 * bar, so it stays visually subordinate to the plain assistant text.
 */
export function ReasoningMessage({ children }: { children: ReactNode }) {
  return (
    <SidebarMessage color={colors.muted}>
      <text fg={colors.muted}>reasoning</text>
      <text fg={colors.muted}>
        <em>
          <span fg={colors.muted}>{children}</span>
        </em>
      </text>
    </SidebarMessage>
  );
}
