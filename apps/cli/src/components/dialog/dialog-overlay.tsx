import { RGBA } from "@opentui/core";
import type { ReactNode } from "react";

/**
 * Fullscreen scrim that dims the app behind a dialog and centers its child.
 *
 * Absolutely positioned over the whole viewport with a semi-transparent black
 * background, so the layout underneath shows through faintly. Relies on a
 * positioned, screen-filling ancestor (the app root) for the `100%` sizing to
 * resolve to the terminal bounds.
 *
 * The scrim colour is built with `RGBA` rather than a `"rgba(…)"` string:
 * OpenTUI's colour parser doesn't handle the CSS functional form and renders it
 * as a muddy opaque colour, so the alpha has to come from `RGBA.fromValues`.
 */
const SCRIM = RGBA.fromValues(0, 0, 0, 0.5);

export function DialogOverlay({ children }: { children: ReactNode }) {
  return (
    <box
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor={SCRIM}
      zIndex={100}
    >
      {children}
    </box>
  );
}
