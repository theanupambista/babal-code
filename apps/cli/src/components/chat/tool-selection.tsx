import { createContext } from "react";

/**
 * Which tool call is highlighted and which are expanded, published by the chat
 * screen and read by `ToolMessage`. Threading it through context (not props)
 * keeps `renderMessageParts`/`ChatLayout`/`ChatMessages` unaware of selection —
 * React context is unaffected by the scrollbox host boundary in between.
 */
export type ToolSelection = {
  /** The `toolId` of the highlighted call, or null when nothing is selected. */
  selectedId: string | null;
  /** `toolId`s whose full output is expanded (bypassing truncation). */
  expandedIds: ReadonlySet<string>;
};

export const ToolSelectionContext = createContext<ToolSelection>({
  selectedId: null,
  expandedIds: new Set(),
});
