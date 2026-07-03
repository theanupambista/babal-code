import { getToolName, isToolUIPart, type UIMessage } from "ai";

type ChatActivityStatus = "submitted" | "streaming" | "ready" | "error";

/** True while a turn is in flight — from send until the stream fully finishes. */
export function isChatBusy(status: ChatActivityStatus): boolean {
  return status === "submitted" || status === "streaming";
}

/**
 * Short status copy for the active turn. `submitted` is the gap before the first
 * chunk; `streaming` covers text, reasoning, and multi-step tool loops until the
 * agent run completes.
 */
export function getChatBusyLabel(
  status: ChatActivityStatus,
  messages: readonly UIMessage[],
): string | null {
  if (!isChatBusy(status)) return null;
  if (status === "submitted") return "…thinking";

  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return "…thinking";

  const lastPart = last.parts.at(-1);
  if (!lastPart) return "…thinking";

  if (isToolUIPart(lastPart)) {
    const name = getToolName(lastPart);
    if (lastPart.state === "approval-requested") return "…awaiting approval";
    if (lastPart.state === "input-streaming" || lastPart.state === "input-available") {
      return `…${name}`;
    }
    return "…working";
  }

  if (lastPart.type === "reasoning") return "…thinking";

  return "…responding";
}
