import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Layer } from "../../services/layer";
import { DialogOverlay } from "./dialog-overlay";
import { Dialog } from "./dialog";

/** The content of a single dialog: a title plus an optional body slot. */
export type DialogContent = {
  /** Heading shown top-left of the dialog. */
  title: string;
  /** Arbitrary body slot. Falls back to a `todo` placeholder when omitted. */
  body?: ReactNode;
};

type DialogContextValue = {
  /** The currently-open dialog, or `null` when nothing is shown. */
  dialog: DialogContent | null;
  /** Open a dialog (replaces any currently-open one). */
  open: (content: DialogContent) => void;
  /** Close the open dialog. */
  close: () => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

/**
 * Provides dialog state to the subtree and renders the open dialog as a
 * fullscreen overlay on top of everything else.
 *
 * Wrap the app (or a screen) in this, then call `useDialog().open(...)` from
 * anywhere below to raise a modal. A single dialog is shown at a time; opening
 * another replaces it. The overlay is rendered last so it paints above the
 * normal layout — the host box should be `position="relative"` and fill the
 * screen so the absolute overlay covers it.
 */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogContent | null>(null);

  const open = useCallback((content: DialogContent) => setDialog(content), []);
  const close = useCallback(() => setDialog(null), []);

  const value = useMemo<DialogContextValue>(() => ({ dialog, open, close }), [dialog, open, close]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog && (
        // A dialog is its own layer: it sits above the screen in the stack, so
        // the screen behind it goes inert (unfocused, keyboard-trapped) and the
        // dialog's own Esc/Ctrl+C handlers take precedence.
        <Layer>
          <DialogOverlay>
            <Dialog title={dialog.title} onClose={close}>
              {dialog.body}
            </Dialog>
          </DialogOverlay>
        </Layer>
      )}
    </DialogContext.Provider>
  );
}

/** Access the dialog controls. Must be used inside a `DialogProvider`. */
export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within a DialogProvider");
  return ctx;
}
