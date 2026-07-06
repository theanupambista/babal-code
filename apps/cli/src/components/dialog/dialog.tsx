import type { ReactNode } from "react";
import { useLayerKeyboard } from "../../services/layer";
import { colors } from "../../theme";

type DialogProps = {
  /** Heading shown top-left of the dialog. */
  title: string;
  /** Called when the user dismisses the dialog (Esc or clicking `esc`). */
  onClose: () => void;
  /** Panel width in columns. Defaults to `DIALOG_WIDTH`. */
  width?: number;
  /** Body slot. Falls back to a `todo` placeholder when omitted. */
  children?: ReactNode;
};

/** Default width of the dialog panel, in columns. */
const DIALOG_WIDTH = 60;

/**
 * The dialog panel itself: a bordered, elevated card with a title on the left,
 * a clickable `esc` affordance on the right, and a body slot below. Pressing
 * Esc (or clicking the label) calls `onClose`.
 *
 * Presentational only — open/close state lives in `DialogProvider`, and the
 * scrim/centering is the `DialogOverlay`'s job.
 */
export function Dialog({ title, onClose, width = DIALOG_WIDTH, children }: DialogProps) {
  // Esc dismisses, and — because the dialog is the active layer — so does Ctrl+C:
  // consuming it here overrides the app-level quit so it just closes the dialog.
  // Both are consumed so they don't reach the screen (or the exit) beneath.
  useLayerKeyboard((key) => {
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      onClose();
      return true;
    }
  });

  return (
    <box
      width={width}
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
