import type { ReactNode } from "react";

/**
 * Scrollable message history. Grows to fill the space the layout gives it and
 * sticks to the bottom so the newest message stays in view as the log streams.
 */
export function ChatMessages({ children }: { children: ReactNode }) {
  return (
    <scrollbox flexGrow={1} focused stickyScroll stickyStart="bottom">
      <box flexDirection="column" gap={1}>
        {children}
      </box>
    </scrollbox>
  );
}
