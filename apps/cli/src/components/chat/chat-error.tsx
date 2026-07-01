import { colors } from "../../theme";

type ChatErrorProps = {
  /** The failure message from `useChat`'s `error`. */
  message: string;
  /** Retry the failed request (typically `useChat`'s `regenerate`). */
  onRetry?: () => void;
  /** Dismiss the banner (typically `useChat`'s `clearError`). */
  onDismiss?: () => void;
};

/**
 * Chat-level error banner. `useChat` surfaces network/API and AI/stream failures
 * as a single `error`, not as a message part — so this is docked once above the
 * input rather than rendered per message. Actions are click targets (mouse) to
 * avoid competing with the textarea for keyboard focus.
 */
export function ChatError({ message, onRetry, onDismiss }: ChatErrorProps) {
  return (
    <box
      flexShrink={0}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={colors.danger}
      paddingLeft={1}
      paddingRight={1}
    >
      <text fg={colors.danger}>{message || "Something went wrong."}</text>
      <box flexDirection="row" gap={2}>
        {onRetry && (
          <box onMouseDown={onRetry}>
            <text fg={colors.accent}>[retry]</text>
          </box>
        )}
        {onDismiss && (
          <box onMouseDown={onDismiss}>
            <text fg={colors.muted}>[dismiss]</text>
          </box>
        )}
      </box>
    </box>
  );
}
