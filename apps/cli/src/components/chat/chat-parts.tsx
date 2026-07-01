import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ReactNode } from "react";
import {
  AssistantMessage,
  ReasoningMessage,
  StepDivider,
  ToolMessage,
  UserMessage,
} from "./chat-message";

/**
 * Maps a UI message's parts to presentational chat components — the single place
 * that knows the AI SDK part shapes. Unhandled part types (source/file/data/…)
 * render nothing; add a branch here when the backend starts producing them.
 */
export function renderMessageParts(message: UIMessage): ReactNode[] {
  return message.parts.map((part, index) => {
    const key = `${message.id}-${index}`;

    if (part.type === "text") {
      return message.role === "user" ? (
        <UserMessage key={key}>{part.text || " "}</UserMessage>
      ) : (
        <AssistantMessage key={key}>{part.text || " "}</AssistantMessage>
      );
    }

    if (part.type === "reasoning") {
      return <ReasoningMessage key={key}>{part.text || " "}</ReasoningMessage>;
    }

    if (part.type === "step-start") {
      return <StepDivider key={key} />;
    }

    // Covers both typed (`tool-${name}`) and `dynamic-tool` parts.
    if (isToolUIPart(part)) {
      // Property access is state-gated: only read output/error where they exist.
      let detail: ReactNode;
      if (part.state === "output-error") detail = part.errorText;
      else if (part.state === "output-available") detail = JSON.stringify(part.output);

      return <ToolMessage key={key} name={getToolName(part)} state={part.state} detail={detail} />;
    }

    return null;
  });
}
