import type { ScrollBoxRenderable } from "@opentui/core";
import type { ReactNode, RefObject } from "react";

/**
 * Scrollable message history. Grows to fill the space the layout gives it and
 * sticks to the bottom so the newest message stays in view as the log streams.
 *
 * `scrollRef` exposes the scrollbox so the chat screen can `scrollChildIntoView`
 * a selected tool call.
 */
export function ChatMessages({
  children,
  scrollRef,
}: {
  children: ReactNode;
  scrollRef?: RefObject<ScrollBoxRenderable | null>;
}) {
  return (
    <scrollbox ref={scrollRef} flexGrow={1} focused stickyScroll stickyStart="bottom">
      <box flexDirection="column" gap={1}>
        {children}
      </box>
    </scrollbox>
  );
}
