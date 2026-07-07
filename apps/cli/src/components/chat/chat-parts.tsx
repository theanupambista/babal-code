import { DEFAULT_MODE_ID, isModeId } from "@babalcode/engine";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ReactNode } from "react";
import { modeColor } from "../../theme";
import {
  AssistantMessage,
  ReasoningMessage,
  ToolMessage,
  UserMessage,
} from "./chat-message";
import { formatToolBody, formatToolTitle } from "./tool-format";

/**
 * Maps a UI message's parts to presentational chat components — the single place
 * that knows the AI SDK part shapes. Unhandled part types (source/file/data/…)
 * render nothing; add a branch here when the backend starts producing them.
 *
 * `streaming` is set only for the actively-generating message; its trailing text
 * part renders in the markdown renderer's streaming mode (unstable last block)
 * until the turn finishes and it re-renders finalized.
 */
export function renderMessageParts(
  message: UIMessage,
  { streaming = false }: { streaming?: boolean } = {},
): ReactNode[] {
  // The mode a user message was sent in rides along as message metadata; tint its
  // border/label with that mode's color (falling back to the default for older logs).
  const rawModeId = (message.metadata as { modeId?: unknown } | undefined)?.modeId;
  const userColor = modeColor(isModeId(rawModeId) ? rawModeId : DEFAULT_MODE_ID);
  const lastIndex = message.parts.length - 1;

  return message.parts.map((part, index) => {
    const key = `${message.id}-${index}`;

    if (part.type === "text") {
      return message.role === "user" ? (
        <UserMessage key={key} color={userColor}>
          {part.text || " "}
        </UserMessage>
      ) : (
        // Only the trailing text part of the generating message is still streaming.
        <AssistantMessage key={key} text={part.text} streaming={streaming && index === lastIndex} />
      );
    }

    if (part.type === "reasoning") {
      return <ReasoningMessage key={key}>{part.text || " "}</ReasoningMessage>;
    }

    // Covers both typed (`tool-${name}`) and `dynamic-tool` parts.
    if (isToolUIPart(part)) {
      const name = getToolName(part);
      const title = formatToolTitle(name, part.input);

      // Property access is state-gated: only read output/error where they exist.
      // The engine tools also report errors as normal output, so `formatToolBody`
      // flags those failures even though the state is `output-available`.
      let detail: string | undefined;
      let failed = false;
      if (part.state === "output-error") {
        detail = part.errorText;
        failed = true;
      } else if (part.state === "output-available") {
        ({ body: detail, failed } = formatToolBody(name, part.output));
      }

      return (
        <ToolMessage
          key={key}
          toolId={key}
          name={name}
          state={part.state}
          title={title}
          detail={detail}
          failed={failed}
        />
      );
    }

    return null;
  });
}
