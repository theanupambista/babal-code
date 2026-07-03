import type { PendingPermission } from "@babalcode/engine";
import { colors } from "../../theme";

type PermissionPromptProps = {
  /** The request currently awaiting an answer (the head of the pending queue). */
  request: PendingPermission;
  /** How many further requests are queued behind this one (parallel tool calls). */
  queued: number;
  /** Allow this action once (`y`). */
  onAllowOnce?: () => void;
  /** Allow and remember for this project (`a`). */
  onAllowAlways?: () => void;
  /** Deny this action once (`n`). */
  onDeny?: () => void;
};

/**
 * Chat-level permission prompt, docked in the same `banner` slot as `ChatError`.
 * A mutating tool has suspended the turn awaiting approval; answering resumes it.
 * Keys (`y`/`a`/`n`) are handled by the chat screen's `useKeyboard` (the textarea
 * is unfocused while this is up); the labels double as mouse click targets.
 */
export function PermissionPrompt({
  request,
  queued,
  onAllowOnce,
  onAllowAlways,
  onDeny,
}: PermissionPromptProps) {
  return (
    <box
      flexShrink={0}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={colors.accent}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={colors.accent}>Permission required</text>
      <text fg={colors.text}>{request.title}</text>
      <box flexDirection="row" gap={2}>
        <box onMouseDown={onAllowOnce}>
          <text fg={colors.plan}>[y] allow once</text>
        </box>
        <box onMouseDown={onAllowAlways}>
          <text fg={colors.plan}>[a] always allow</text>
        </box>
        <box onMouseDown={onDeny}>
          <text fg={colors.danger}>[n] deny</text>
        </box>
      </box>
      {queued > 0 && (
        <text fg={colors.muted}>
          {queued} more request{queued > 1 ? "s" : ""} queued
        </text>
      )}
    </box>
  );
}
