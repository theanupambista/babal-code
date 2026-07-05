import { useKeyboard } from "@opentui/react";
import type { ReactNode } from "react";
import { colors } from "../../theme";

type DialogProps = {
  /** Heading shown top-left of the dialog. */
  title: string;
  /** Called when the user dismisses the dialog (Esc or clicking `esc`). */
  onClose: () => void;
  /** Body slot. Falls back to a `todo` placeholder when omitted. */
  children?: ReactNode;
};

/** Width of the dialog panel, in columns. */
const DIALOG_WIDTH = 60;

/**
 * The dialog panel itself: a bordered, elevated card with a title on the left,
 * a clickable `esc` affordance on the right, and a body slot below. Pressing
 * Esc (or clicking the label) calls `onClose`.
 *
 * Presentational only — open/close state lives in `DialogProvider`, and the
 * scrim/centering is the `DialogOverlay`'s job.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  useKeyboard((key) => {
    if (key.name === "escape") onClose();
  });

  return (
    <box
      width={DIALOG_WIDTH}
      flexDirection="column"
      backgroundColor={colors.panel}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      {/* Header: title left, esc affordance right. */}
      <box flexDirection="row" justifyContent="space-between">
        <text fg={colors.text}>
          <b>{title}</b>
        </text>
        <box onMouseDown={onClose}>
          <text fg={colors.muted}>esc</text>
        </box>
      </box>

      {/* Body slot. */}
      {children ?? <text fg={colors.muted}>todo</text>}
    </box>
  );
}
