import type { ToolUIPart } from "ai";
import type { ReactNode } from "react";
import { colors } from "../../theme";
import { EmptyBorder } from "../border";

type ChatMessageProps = {
  /** Short role label shown above the body (e.g. "you", "babal"). */
  label: string;
  /** Color of the role label. Defaults to muted. */
  labelColor?: string;
  /** Message body. Must be text-compatible nodes (strings, <span>, <em>…). */
  children: ReactNode;
};

/**
 * Base chat bubble: a role label stacked above the message body. Every role
 * variant below is a thin wrapper that fixes the label and its color, so all
 * spacing/typography stays in one place.
 */
export function ChatMessage({ label, labelColor = colors.muted, children }: ChatMessageProps) {
  return (
    <box flexDirection="column">
      <text fg={labelColor}>{label}</text>
      <text fg={colors.text}>{children}</text>
    </box>
  );
}

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
        paddingX={3}
        paddingY={1}
        flexDirection="column"
        flexGrow={1}
      >
        <text fg={colors.text}>{children}</text>
      </box>
    </box>
  );
}

/** A message authored by the assistant — plain text, no label. */
export function AssistantMessage({ children }: { children: ReactNode }) {
  return <text fg={colors.text}>{children}</text>;
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
 * A tool call, labelled with the tool name and a status derived from its state.
 * `detail` is the output/error body; it turns red when the call failed.
 */
export function ToolMessage({
  name,
  state,
  detail,
}: {
  name: string;
  state: ToolUIPart["state"];
  detail?: ReactNode;
}) {
  const failed = state === "output-error";
  return (
    <ChatMessage label={`tool · ${name} · ${TOOL_STATUS[state]}`}>
      <span fg={failed ? colors.danger : colors.muted}>{detail ?? " "}</span>
    </ChatMessage>
  );
}

/** A step boundary between multi-step assistant turns, drawn as a thin rule. */
export function StepDivider() {
  return <box border={["top"]} borderStyle="single" borderColor={colors.muted} />;
}

/** The assistant's intermediate reasoning, rendered muted and italic. */
export function ReasoningMessage({ children }: { children: ReactNode }) {
  return (
    <ChatMessage label="reasoning">
      <em>
        <span fg={colors.muted}>{children}</span>
      </em>
    </ChatMessage>
  );
}
